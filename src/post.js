const core = require('@actions/core');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');
const exec = require('@actions/exec');

async function run() {
  try {
    const s3Bucket = core.getState('s3-bucket');
    const fileName = core.getState('file-name');
    const tarOption = core.getState('tar-option');
    const paths = core.getState('paths');

    const s3 = new AWS.S3();

    await exec.exec('bash', ['-c', `tar ${tarOption} -czf ${fileName} ${paths}`]);

    const fileStream = fs.createReadStream(fileName);

    const headParams = {
      Bucket: s3Bucket,
      Key: fileName,
    };

    try {
      await s3.headObject(headParams).promise();
      console.log(`File ${fileName} already exists in ${s3Bucket}. Skipping upload.`);
      return;
    } catch (headErr) {
      console.log(`File ${fileName} does not exist in ${s3Bucket}. Proceeding with upload.`);
    }

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
