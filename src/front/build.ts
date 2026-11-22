import { build } from '@itrocks/build/build.js'

type Selection = { mode: 'all' | 'none'; ids: string[]; matches: number }
type ListSelection = Selection & { count: number; filter: string; partial?: Selection | null }
type Pending = { state: ListSelection; saved: Promise<void> }

const mounted = new WeakSet<HTMLInputElement>()
const pending = new Map<string, Pending>()
const rowSelector = ':scope > tr > th.select > input[name=id]'

build<HTMLInputElement>('article[data-action="list"] table.objects input[data-list-selection]', master => {
	if (mounted.has(master)) return
	mounted.add(master)

	const table = master.closest('table')!
	const form  = master.form!
	const body  = table.tBodies[0]
	const footer = form.querySelector<HTMLElement>(':scope > footer')!
	const shortcut = footer.querySelector<HTMLButtonElement>('button[data-list-selection-shortcut]')
	const shortcutItem = shortcut?.closest('li')
	const summary = footer.querySelector<HTMLElement>('[data-list-selection-count]')
	const summaryItem = summary?.closest('li')
	const url   = form.action
	const state = JSON.parse(decodeURIComponent(master.dataset.listSelection!)) as ListSelection
	const previous = pending.get(url)?.state
	if (previous && state.filter === previous.filter) {
		state.mode    = previous.mode
		state.ids     = previous.ids
		state.matches = previous.matches
		state.partial = previous.partial
	}
	const ids = new Set(state.ids)
	const current = (): Selection => ({ mode: state.mode, ids: [...ids], matches: state.matches })
	const matchingSelected = ({ mode, matches }: Selection) => (mode === 'all') ? state.count - matches : matches
	const selectedCount = (selection: Selection, idCount = selection.ids.length) =>
		(selection.mode === 'all') ? matchingSelected(selection) : idCount
	const isAll = (selection: Selection) => state.count > 0 && matchingSelected(selection) === state.count
	const isPartial = (selection: Selection) => selectedCount(selection) > 0 && !isAll(selection)
	if (state.partial === undefined && isPartial(state)) state.partial = current()

	let footerHovered = false
	const updateFooter = () => {
		const hidden = form.dataset.listSelectionActive === 'false' && !footerHovered
		if (hidden && footer.contains(document.activeElement)) {
			master.focus({ preventScroll: true })
		}
		footer.inert = hidden
	}
	const updateFooterHover = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse') return
		footerHovered = event.type === 'pointerenter'
		updateFooter()
	}
	footer.addEventListener('pointerenter', updateFooterHover)
	footer.addEventListener('pointerleave', updateFooterHover)

	const update = () => {
		const all = state.mode === 'all'
		// Count the saved selection, including IDs whose rows have not been loaded.
		const selected = selectedCount(state, ids.size)
		for (const row of body.querySelectorAll<HTMLInputElement>(rowSelector)) {
			row.checked = all !== ids.has(row.value)
		}
		master.checked       = isAll(state)
		master.indeterminate = selected > 0 && !master.checked
		master.disabled      = state.count === 0 && selected === 0 && !(state.partial && isPartial(state.partial))
		form.dataset.listSelectionActive = String(selected > 0)
		if (summary && selected > 0) {
			const text = (selected === 1) ? summary.dataset.singular : summary.dataset.plural?.replace('$1', String(selected))
			if (summary.textContent !== text) summary.textContent = text ?? ''
		}
		updateFooter()
	}

	const save = (remember?: 'current' | 'forget') => {
		const selection = current()
		const params = new URLSearchParams({ listSelection: state.mode })
		if (remember) params.set('rememberPartial', remember)
		for (const id of selection.ids) params.append('id', id)
		const previous = pending.get(url)?.saved
		const saved = (previous?.catch(() => {}) ?? Promise.resolve()).then(async () => {
			const response = await fetch(url, { method: 'POST', body: params, keepalive: true })
			if (!response.ok) throw new Error('Unable to save the list selection')
		})
		pending.set(url, { saved, state: { ...state, ...selection } })
		void saved.catch(error => console.error(error)).then(() => {
			if (pending.get(url)?.saved === saved) pending.delete(url)
		})
	}

	const cycleSelection = () => {
		const active  = current()
		const all     = isAll(active)
		const partial = state.partial
		const restore = !all && !isPartial(active) && partial && isPartial(partial)
		state.mode    = restore ? partial.mode : (all ? 'none' : 'all')
		state.matches = restore ? partial.matches : 0
		ids.clear()
		if (restore) for (const id of partial.ids) ids.add(id)
		update()
		save(restore ? 'current' : undefined)
	}
	master.addEventListener('change', cycleSelection)
	shortcut?.addEventListener('click', cycleSelection)
	body.addEventListener('change', event => {
		const row = event.target
		if (!(row instanceof HTMLInputElement) || row.name !== 'id') return
		const override = (state.mode === 'all') !== row.checked
		if (override === ids.has(row.value)) return
		if (override) ids.add(row.value)
		else ids.delete(row.value)
		state.matches += override ? 1 : -1
		const active = current()
		state.partial = isPartial(active) ? active : null
		update()
		save(state.partial ? 'current' : 'forget')
	})
	const observer = new MutationObserver(update)
	observer.observe(body, { childList: true })

	let selectionSubmit = false
	form.addEventListener('submit', event => {
		selectionSubmit = !!event.submitter?.closest('footer .selection.actions')
		queueMicrotask(() => { selectionSubmit = false })
	}, { capture: true })
	form.addEventListener('formdata', ({ formData }) => {
		formData.delete('id')
		if (!selectionSubmit) return
		formData.set('selectionMode', state.mode)
		if (state.mode === 'all') formData.set('selectionFilter', state.filter)
		for (const id of ids) formData.append('id', id)
		selectionSubmit = false
	})

	const control = master.closest('label') ?? master
	control.hidden = false
	if (shortcutItem) shortcutItem.hidden = false
	if (summaryItem) summaryItem.hidden = false
	update()
})
