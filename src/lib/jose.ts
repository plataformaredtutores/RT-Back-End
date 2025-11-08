// Lazy ESM loader for 'jose' to work under CommonJS/ts-node

// IMPORTANT: This is an AI generated file. PR Reviewer: idk if it need revision (if works ok, just check that it works), who tf is jose? jaja

let _jose: typeof import('jose') | null = null

export async function getJose() {
  if (_jose) return _jose
  // Use a runtime dynamic import via Function to avoid TypeScript transforming
  // import() into a require(...) when "module" is "commonjs" in tsconfig.
  // The Function-based import() remains a native dynamic ESM import at runtime
  // and allows loading ESM-only packages like 'jose' under ts-node.
  // See: https://github.com/nodejs/node/issues/37194#issuecomment-899418015
  // Create the importer dynamically so bundlers/tsc don't rewrite it.
  const dynamicImport = new Function('id', 'return import(id)') as (
    id: string
  ) => Promise<typeof import('jose')>
  _jose = await dynamicImport('jose')
  return _jose
}
