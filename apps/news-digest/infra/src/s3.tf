resource "aws_s3_bucket" "state" {
  bucket = var.s3_bucket_name

  tags = {
    Name    = var.s3_bucket_name
    Purpose = "News digest pipeline state and articles"
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}
