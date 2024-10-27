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
    const paths = core.getInput('paths', { required: true });
    const command = core.getInput('command', { required: true });
    const tarOption = core.getInput('tar-option', { required: false });
    const untarOption = core.getInput('untar-option', { required: false });
    const workingDirectory = core.getInput('working-directory', { required: false });
    const cacheHitSkip = JSON.parse(core.getInput('cache-hit-skip', { required: false }) || 'false');
    const fileName = cacheKey + '.tar.zst';
    const filePath = path.join(workingDirectory, fileName);

    process.chdir(workingDirectory);

    core.saveState('s3-bucket', s3Bucket);
    core.saveState('file-name', fileName);
    core.saveState('tar-option', tarOption);
    core.saveState('paths', paths);

    const params = {
      Bucket: s3Bucket,
      Key: fileName,
    };

    let contentLength;
    try {
      const headObject = await s3.headObject(params).promise();
      contentLength = headObject.ContentLength;
    } catch (headErr) {
      console.log(`No cache is found for key: ${fileName}`);
      await exec.exec(command); // install or build command e.g. npm ci, npm run dev
      core.saveState('cache-upload', true);
      return;
    }

    // Cache found. Download and extract
    const fileStream = fs.createWriteStream(filePath);
    const s3Stream = downloader.download(params, {
      totalObjectSize: contentLength,
      concurrentStreams: 20,
    });
    s3Stream.pipe(fileStream);
    s3Stream.on('downloaded', async () => {
      console.log(`Found a cache for key: ${fileName}`);
      if (cacheHitSkip) {
        console.log(`Cache found, skipping command: ${command}`);
        return;
      }
      await exec.exec(`tar ${untarOption} --use-compress-program=zstd -xf ${fileName}`);
      await exec.exec(`rm -f ${fileName}`);
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
