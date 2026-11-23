# actions-s3-cache

This action installs dependencies or builds, and caches them in S3.

## Usage

```yaml
steps:
  - uses: actions/checkout@v2
  # Credentials come from the environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and
  # AWS_SESSION_TOKEN). In getjerry repos, assume a gha-* role through GitHub OIDC first
  # (the job needs `permissions: id-token: write`).
  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: arn:aws:iam::919341117301:role/gha-pr # gha-pr on pull_request, gha-nonprod / gha-prod elsewhere
      aws-region: us-west-2
  - uses: getjerry/actions-s3-cache@master
    env:
      AWS_DEFAULT_REGION: us-west-2
    with:
      s3-bucket: your-s3-bucket-name # required
      cache-key: npm-v1-${{ hashFiles('laravel/package-lock.json') }} # required ('.zip' is unnecessary)
      paths: node_modules # required 
      command: npm ci # required
      zip-option: -ryq # optional (default: -ryq)
      unzip-option: -n # optional (default: -n)
      working-directory: laravel # optional (default: ./)
      cache-hit-skip: false # optional (defaultL: false) set to true will skip run command when cache hit
```

## IAM Policy Example

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
            ],
            "Resource": [
                "arn:aws:s3:::your-s3-bucket-name",
                "arn:aws:s3:::your-s3-bucket-name/*"
            ]
        }
    ]
}
```
## License

[MIT License](https://github.com/shonansurvivors/actions-s3-cache/blob/master/LICENCE) - Copyrights (c) 2020 shonansurvivors
