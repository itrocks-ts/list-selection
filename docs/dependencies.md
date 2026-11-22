# Dependency binding

`bindListSelection({ runList, transaction })` enables the list controls and the bulk selection resolver.

- `runList(request)` runs the routed HTML list action with the current user's access rules. The list supplies its
  effective criteria without querying rows or writing list settings.
- `transaction(session, write)` applies the selection update to the active session and acknowledges the save.

The it.rocks framework supplies both callbacks during startup. Hosts using the base list can omit this binding.
