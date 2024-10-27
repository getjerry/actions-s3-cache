const core = require('@actions/core');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');

async function run() {
  try {
    const s3Bucket = core.getState('s3-bucket');
    const fileName = core.getState('file-name');
    const tarOption = core.getState('tar-option');
    const paths = core.getState('paths');

    const s3 = new AWS.S3();

    await exec.exec('bash', ['-c', `tar ${tarOption} -czf ${fileName} ${paths}`]);

    s3.upload(
      {
        Body: fs.readFileSync(fileName),
        Bucket: s3Bucket,
        Key: fileName,
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
