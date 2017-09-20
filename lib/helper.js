const path = require("path");
const fs = require('fs-extra');
const targz = require('targz');
const pickBy = require('lodash/pickBy');
const forEach = require('lodash/forEach');
const crypto = require('crypto');
const compareVersions = require('compare-versions');


function scan(directory, output) {
  let foldersCount = 0, processedCount = 0;

  const doTheThing = (sourceFolderStr, destParentFolderStr) => {
    const folderStr = sourceFolderStr.substring(sourceFolderStr.lastIndexOf(path.sep));
    const packageDirPath = path.join(destParentFolderStr, folderStr, `package-${Date.now()}`);

    let packageObj = fs.readJsonSync(path.join(sourceFolderStr, 'package.json'));
    packageObj = pickBy(packageObj, (value, key) => !key.startsWith('_'));

    const tarFile = `${packageObj.name.substring(packageObj.name.lastIndexOf('/') + 1)}-${packageObj.version}.tgz`;
    let tarFilePath = path.join(destParentFolderStr, folderStr, tarFile);

    //check for existence
    try {
      let fd = fs.openSync(tarFilePath, 'r');
      fs.close(fd);
    } catch (e) {
      console.log(`Processing ${tarFile}...`);

      //copy
      fs.copySync(sourceFolderStr, path.join(packageDirPath, 'package'), {filter: (src, dest) => !src.endsWith('node_modules')});
      //edit package json
      fs.writeJsonSync(path.join(packageDirPath, 'package', 'package.json'), packageObj);
      //compress
      targz.compress({
        src: packageDirPath,
        dest: tarFilePath
      }, err => {
        if (err) {
          console.log(err);
        } else {
          const hash = crypto.createHash('sha1');
          const input = fs.createReadStream(tarFilePath);
          input.on('readable', () => {
            const data = input.read();
            if (data) {
              hash.update(data);
            } else {
              const shasum = hash.digest('hex');
              const packagePath = path.join(destParentFolderStr, folderStr, 'package.json');
              fs.ensureFileSync(packagePath);
              let pkg = {};
              try {
                pkg = fs.readJsonSync(packagePath);
              } catch (e) {
                pkg = {
                  name: packageObj.name,
                  versions: {}
                };
              }
              pkg.versions[packageObj.version] = packageObj;
              pkg.versions[packageObj.version]['dist'] = {
                shasum: shasum,
                tarball: `https://127.0.0.1:4873/${packageObj.name}/-/${tarFile}`
              };
              pkg = pickBy(pkg, (value, key) => {
                return !key.startsWith('_');
              });
              delete pkg['dist-tags'];
              fs.writeJsonSync(packagePath, pkg);
              fs.remove(packageDirPath, err => {
                if (err) {
                  console.log(err);
                }
              });
            }
          });
        }
      });
    }
  };
  const _scan = (dir, out) => {
    fs.readdir(dir, (err, folders) => {
      if (err) {
        console.error(err.message);
      } else {
        foldersCount += folders.length;
        folders.forEach((folder, i) => {
          if (!folder.startsWith('.')) {
            let packagePath = path.join(dir, folder);
            fs.readdir(packagePath, (err2, files) => {
              if (!err2) {
                if (files.includes('package.json')) {
                  doTheThing(packagePath, out);
                  if (files.includes('node_modules')) {
                    _scan(path.join(packagePath, 'node_modules'), out)
                  }
                } else {
                  files.forEach((file2, j) => {
                    let subpackagePath = path.join(packagePath, file2);
                    fs.readdir(subpackagePath, (err3, subfiles) => {
                      if (subfiles && subfiles.includes('package.json')) {
                        doTheThing(subpackagePath, path.join(out, folder));
                        // console.log(`processed ${++processedCount} of ${++foldersCount} files`);
                      }
                    });
                  });
                }
              }
              // console.log(`processed ${++processedCount} of ${foldersCount} files`);
            });
          }
        });
      }
    });
  };

  _scan(directory, output)
}

function reset(storageFolder, repositoryUrl) {
  const MIN_VERSION = "0";

  const scanFolder = (rootFolder) => {
    fs.readdir(rootFolder, (err, folders) => {
      if (err) {
        console.error(err.message);
      } else {
        folders.forEach(folder => {
          let packagePath = path.join(rootFolder, folder);
          fs.readdir(packagePath, (err2, files) => {
            if (!err2) {
              if (files.includes('package.json')) {
                resetPackage(packagePath, files);
              } else {
                scanFolder(packagePath);
              }
            }
          });
        });
      }
    });
  };

  const resetPackage = (packagePath, files) => {
    const packageDotJson = path.join(packagePath, 'package.json');
    try {
      let packageObj = fs.readJsonSync(packageDotJson);

      let versions = [];
      let latestVersion = MIN_VERSION;
      let simplePackageName = packageObj.name.split('/');
      simplePackageName = simplePackageName[simplePackageName.length - 1];
      files.forEach(file => {
        if (file !== 'package.json' && file.endsWith('.tgz')) {
          const version = file.substring(file.indexOf(simplePackageName) + simplePackageName.length + 1, file.length - 4);
          versions.push(version);
        }
      });

      let cachedVersions = {};
      forEach(packageObj.versions, (value, version) => {
        if (versions.indexOf(version) !== -1) {
          let tarballUrl = value.dist.tarball;
          if (!tarballUrl.startsWith(repositoryUrl)) {
            tarballUrl = `${repositoryUrl}${tarballUrl.substr(tarballUrl.indexOf(packageObj.name))}`;
          }
          cachedVersions[version] = Object.assign({}, value);
          cachedVersions[version].dist.tarball = tarballUrl;

          if (compareVersions(latestVersion, version) === -1) {
            latestVersion = version;
          }
        }
      });

      packageObj.versions = cachedVersions;
      if (packageObj['dist-tags'] && latestVersion !== MIN_VERSION) {
        packageObj['dist-tags'].latest = latestVersion;
        if (packageObj['dist-tags'].stable && compareVersions(packageObj['dist-tags'].stable, latestVersion) === 1) {
          packageObj['dist-tags'].stable = latestVersion;
        }
      }

      fs.writeJsonSync(packageDotJson, packageObj);

      console.log("package '%s' has been reseted", packageObj.name);
    } catch (e) {
      console.error(e);
    }
  };

  scanFolder(storageFolder);
}

module.exports = {
  scan,
  reset
};