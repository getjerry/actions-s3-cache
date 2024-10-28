const core = require('@actions/core');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');
const exec = require('@actions/exec');

const s3 = new AWS.S3();

async function run() {
  try {
    const s3Bucket = core.getState('s3-bucket');
    const fileName = core.getState('file-name');
    const tarOption = core.getState('tar-option');
    const paths = core.getState('paths');
    const cacheUpload = core.getState('cache-upload');
    const workingDirectory = core.getInput('working-directory', { required: false });

    process.chdir(workingDirectory);

    if (!cacheUpload) {
      console.log(`Cache upload unset. Skipping upload.`);
      return;
    }

    await exec.exec('bash', ['-c', `tar ${tarOption} ${fileName} ${paths}`]);

    const fileStream = fs.createReadStream(fileName);

    s3.upload(
      {
        Body: fileStream,
        Bucket: s3Bucket,
        Key: fileName,
        PartSize: 10 * 1024 * 1024, // 10 MB
        QueueSize: 10, // 10 concurrent uploads
      },
      (err, data) => {
        if (err) {
          console.log(`Failed to store ${fileName}`);
        } else {
          console.log(`Stored cache to ${fileName}`);
        }
      },
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
