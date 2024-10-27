const core = require('@actions/core');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');
const exec = require('@actions/exec');

async function run() {
  try {
    const s3Bucket = core.getInput('s3-bucket', { required: true });
    const cacheKey = core.getInput('cache-key', { required: true });
    const paths = core.getInput('paths', { required: true });
    const tarOption = core.getInput('tar-option', { required: false });
    const fileName = cacheKey + '.tar.gz';

    const s3 = new AWS.S3();

    // Check if the file already exists in the S3 bucket
    try {
      await s3.headObject({ Bucket: s3Bucket, Key: fileName }).promise();
      console.log(`File ${fileName} already exists in the bucket ${s3Bucket}. Skipping upload.`);
      return;
    } catch (err) {
      if (err.code !== 'NotFound') {
        throw err;
      }
      console.log(`File ${fileName} does not exist in the bucket ${s3Bucket}. Proceeding with upload.`);
    }

    // Create the tarball
    await exec.exec('bash', ['-c', `tar ${tarOption} -czf ${fileName} ${paths}`]);

    // Upload the tarball to S3
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
