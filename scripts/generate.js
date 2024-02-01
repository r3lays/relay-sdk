const { readFileSync, writeFileSync } = require('fs');
const { execSync } = require('child_process');
const wsOutput = execSync('yarn workspaces list --json', {
  encoding: 'utf-8',
});

// We will only try to update dependencies in these package file types
const DEP_TYPES_TO_UPDATE = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
];

// Used to look up the current package.json version at a location
const getPackageFile = (location) =>
  JSON.parse(readFileSync(`${location}/package.json`));

// Object map of entries to make version replacement easier when we publish
const workspaceVersionMap = Object.fromEntries(
  wsOutput
    // Create an array from the command response
    .split('\n')
    // Filter out any empty strings (last newline from split)
    .filter((string) => Boolean(string))
    // Parse JSON strings
    .map((string) => JSON.parse(string))
    // Create [key, value] and lookup version
    .map(({ location, name }) => [
      name,
      { location, version: getPackageFile(location).version },
    ])
);

// Go replace versions in each package.json file
for (const pkg in workspaceVersionMap) {
  const { location } = workspaceVersionMap[pkg];

  // Get the packagefile data that we will use to rewrite the version updates.
  // NOTE: This data will be mutated in JS before we output to overwrite the file
  const packageFile = getPackageFile(location);

  // Used to target a package.json dependency list type and if the dependency matches one of our workspace packages,
  // we update the version to match the current workspace version in our workspace version map.
  const mutuateDeps = (depType) => {
    // Get the dependency type from the file and iterate over each dependency
    for (const dep in packageFile[depType]) {
      // if a dependency matches one of the dependencies in our workspace map
      if (Object.keys(workspaceVersionMap).includes(dep)) {
        // we mutate the package file data in memory to match the current workspace version
        packageFile[depType][dep] = workspaceVersionMap[dep].version;
      }
    }
  };

  // Go mutate the allowed dependency types
  DEP_TYPES_TO_UPDATE.map((dependencyType) => mutuateDeps(dependencyType));

  // Write our updated files
  writeFileSync(
    `${location}/package.json`,
    // Convert the file data to json
    // include the 2 space indent formatting
    // and also add an empty newline at the end
    `${JSON.stringify(packageFile, null, 2)}\n`
  );
}