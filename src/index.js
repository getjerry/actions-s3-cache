const core = require('@actions/core');
const exec = require('@actions/exec');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');

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
    const fileName = cacheKey + '.tar.gz';

    process.chdir(workingDirectory);

    const s3 = new AWS.S3();

    s3.getObject(
      {
        Bucket: s3Bucket,
        Key: fileName,
      },
      async (err, data) => {
        if (err) {
          console.log(`No cache is found for key: ${fileName}`);

          await exec.exec(command); // install or build command e.g. npm ci, npm run dev
        } else {
          console.log(`Found a cache for key: ${fileName}`);
          if (cacheHitSkip) {
            console.log(`Cache found, skipping command: ${command}`);
            return;
          }
          fs.writeFileSync(fileName, data.Body);

          await exec.exec(`tar ${untarOption} -xzf ${fileName}`);
          void exec.exec(`rm -f ${fileName}`);
        }
      },
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
