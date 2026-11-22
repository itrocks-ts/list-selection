[![npm version](https://img.shields.io/npm/v/@itrocks/list-selection?logo=npm)](https://www.npmjs.org/package/@itrocks/list-selection)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/list-selection)](https://www.npmjs.org/package/@itrocks/list-selection)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/list-selection?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/list-selection)
[![issues](https://img.shields.io/github/issues/itrocks-ts/list-selection)](https://github.com/itrocks-ts/list-selection/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# list-selection

Session-based selection and bulk actions for object lists.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

The checkbox in the list heading cycles between all matching results and an empty selection. If a partial
selection was saved, the next click from an empty selection restores it. The arrow in the action bar advances
the same cycle while the bar is visible. The bar appears whenever rows are selected and counts the full
selection, including rows that have yet to load. The session retains both selections for each business class.
When the selection is empty, the arrow stays available while the mouse is over the bar.
Selecting every matching row manually or clearing the last selected row forgets the partial selection. The
heading checkbox and the arrow preserve it when they select or clear the whole list.

Bulk actions receive `selectionMode=all` with excluded `id` values, or `selectionMode=none` with
included `id` values. An omitted mode also treats IDs as explicitly selected.

See [dependency binding](docs/dependencies.md) to enable the plugin in another host.
