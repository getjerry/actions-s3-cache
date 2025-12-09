const core = require('@actions/core');
const exec = require('@actions/exec');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');
const path = require('path');

const s3 = new AWS.S3();
const downloader = require('s3-download')(s3);

async function run() {
  try {
    const s3Bucket = core.getInput('s3-bucket', { required: true });
    const cacheKey = core.getInput('cache-key', { required: true });
    const restoreKeys = core.getInput('restore-keys', { required: false }).split('\n').map(x => x.trim()).filter(x => x);
    const paths = core.getInput('paths', { required: true });
    const command = core.getInput('command', { required: true });
    const tarOption = core.getInput('tar-option', { required: false });
    const untarOption = core.getInput('untar-option', { required: false });
    const workingDirectory = core.getInput('working-directory', { required: false });
    const cacheHitSkip = JSON.parse(core.getInput('cache-hit-skip', { required: false }) || 'false');
    const fileName = cacheKey + '.tar.zst';

    process.chdir(workingDirectory);

    core.saveState('s3-bucket', s3Bucket);
    core.saveState('file-name', fileName);
    core.saveState('tar-option', tarOption);
    core.saveState('paths', paths);

    const params = {
      Bucket: s3Bucket,
      Key: fileName,
    };

    let foundKey = null;
    let exactMatch = false;
    let contentLength;

    try {
      const headObject = await s3.headObject(params).promise();
      contentLength = headObject.ContentLength;
      foundKey = fileName;
      exactMatch = true;
    } catch (headErr) {
      // Not found exact match
    }

    if (!foundKey && restoreKeys.length > 0) {
      for (const keyPrefix of restoreKeys) {
        const listParams = {
          Bucket: s3Bucket,
          Prefix: keyPrefix
        };
        const listedObjects = await s3.listObjectsV2(listParams).promise();
        if (listedObjects.Contents && listedObjects.Contents.length > 0) {
          const matches = listedObjects.Contents
            .filter(obj => obj.Key.endsWith('.tar.zst'))
            .sort((a, b) => b.LastModified - a.LastModified);

          if (matches.length > 0) {
            foundKey = matches[0].Key;
            contentLength = matches[0].Size;
            break;
          }
        }
      }
    }

    if (!foundKey) {
      console.log(`No cache is found for key: ${fileName}`);
      await exec.exec(command); // install or build command e.g. npm ci, npm run dev
      core.saveState('cache-upload', true);
      return;
    }

    // Skip command to save time
    if (exactMatch && cacheHitSkip) {
      console.log(`Cache found, skipping command: ${command}`);
      return;
    }

    // Cache found. Download and extract
    console.log(`Found a cache for key: ${foundKey}`);
    const fileStream = fs.createWriteStream(fileName);
    const s3Stream = downloader.download({
      Bucket: s3Bucket,
      Key: foundKey
    }, {
      totalObjectSize: contentLength,
      concurrentStreams: 20,
    });
    s3Stream.pipe(fileStream);

    await new Promise((resolve, reject) => {
      s3Stream.on('downloaded', resolve);
      s3Stream.on('error', reject);
      fileStream.on('error', reject);
    });

    await exec.exec(`tar ${untarOption} ${fileName}`);
    await exec.exec(`rm -f ${fileName}`);
    console.log(`Restored from restore-key: ${foundKey}`);

    // When fuzzy matched cache, will need to upload latest files in post step. 
    // Require workflow to run additional steps to update the cache files otherwise uploaded cache will not match
    if(!exactMatch) {
      core.saveState('cache-upload', true);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
