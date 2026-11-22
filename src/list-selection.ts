import { actionRequestDependsOn } from '@itrocks/action-request'
import { InvalidSelectionError }  from '@itrocks/action-request'
import { Request }                from '@itrocks/action-request'
import { listDependsOn }          from '@itrocks/list'
import type { ListSearch }        from '@itrocks/list/search'
import { resolveListSearch }      from '@itrocks/list/search'
import { Request as HttpRequest } from '@itrocks/request-response'
import { Response }               from '@itrocks/request-response'
import type { Session }           from '@itrocks/request-response'
import { routeOf }                from '@itrocks/route'
import { dataSource }             from '@itrocks/storage'
import { Identifiers }            from '@itrocks/storage'
import { tr }                     from '@itrocks/translate'
import { createHash }             from 'node:crypto'

type Selection = { mode: 'all' | 'none'; ids: string[] }
type StoredSelection = Selection & { partial?: Selection | null }
type Dependencies = {
	runList:     (request: Request) => Promise<unknown>
	transaction: (session: Session, write: (data: Session) => void) => Promise<void>
}

function filterKey(search: ListSearch): string
{
	const filters = Object.entries(search.filters).filter(([, value]) => value !== '').sort()
	return createHash('sha256').update(JSON.stringify(filters)).digest('base64url')
}

async function selectionView(request: Request, search: ListSearch, { mode, ids }: Selection)
{
	if (!ids.length) return { mode, ids, matches: 0 }
	const all    = mode === 'all'
	const source = dataSource()
	const filter = new Identifiers(ids)
	const rows   = (await source.select(request.type, [], all ? search.criteria : undefined, filter)).rows
	const matches = (!all && rows.length && Reflect.ownKeys(search.criteria).length)
		? (await source.select(request.type, [], search.criteria, filter)).rows.length
		: rows.length
	return {
		mode,
		ids: all ? ids : rows.map(row => String(row.rootId)),
		matches
	}
}

export function bindListSelection({ runList, transaction }: Dependencies): void
{
	listDependsOn({ selection: {
		update: async request => {
			const mode = request.data.listSelection
			if (mode === undefined) return
			if (request.request.method !== 'POST' || (mode !== 'all' && mode !== 'none'))
				return new Response('', 400)
			const ids = [...new Set(request.ids)]
			if (ids.some(id => typeof id !== 'string' || id === '')) return new Response('', 400)
			const key = routeOf(request.type)
			await transaction(request.request.session, session => {
				session.listSelection ??= {}
				const previous = session.listSelection[key] as StoredSelection | undefined
				const remember = request.data.rememberPartial
				let   partial  = previous?.partial
				if (partial === undefined && previous?.ids.length) {
					partial = { mode: previous.mode, ids: previous.ids }
				}
				// An omitted partial uses the active selection. Null explicitly forgets it.
				session.listSelection[key] = (remember === 'current')
					? { mode, ids }
					: { mode, ids, partial: (remember === 'forget') ? null : partial }
			})
			return new Response('', 204)
		},
		view: async (request, search, count) => {
			const key = routeOf(request.type)
			const selection: StoredSelection = request.request.session.listSelection?.[key] ?? { mode: 'none', ids: [] }
			const active  = await selectionView(request, search, selection)
			const partial = selection.partial && await selectionView(request, search, selection.partial)
			const label   = tr('Select all, clear, or restore selection')
			return {
				template: '/@itrocks/list-selection/cjs/selection.html',
				footer: { label, template: '/@itrocks/list-selection/cjs/selection-shortcut.html' },
				footerSummary: {
					plural: tr('$1 selected'), singular: tr('1 selected'),
					template: '/@itrocks/list-selection/cjs/selection-summary.html'
				},
				label,
				state: encodeURIComponent(JSON.stringify({
					...active, count, filter: filterKey(search), partial
				}))
			}
		}
	} })

	actionRequestDependsOn({ selectionIds: async request => {
		if (request.data.selectionMode !== 'all') throw new InvalidSelectionError('Unsupported selection mode.')
		const http = request.request
		const list = new Request(new HttpRequest(
			'GET', http.scheme, http.host, http.port, request.route + '/list/html', http.headers,
			{}, {}, http.session, http.raw, http.basePath
		))
		const search = await resolveListSearch(list, runList)
		if (!search || (request.data.selectionFilter !== undefined && request.data.selectionFilter !== filterKey(search)))
			throw new InvalidSelectionError('The list filters have changed. Reload the list and try again.')
		const excluded = new Set(request.ids)
		const result   = await dataSource().select(request.type, [], search.criteria)
		return result.rows.map(row => String(row.rootId)).filter(id => !excluded.has(id))
	} })
}
