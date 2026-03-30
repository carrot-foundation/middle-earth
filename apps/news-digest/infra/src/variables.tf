variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "news-digest"
}

variable "s3_bucket_name" {
  description = "S3 bucket for pipeline state"
  type        = string
  default     = "news-digest-pipeline-state"
}

variable "slack_channel_id" {
  description = "Slack channel ID for digest"
  type        = string
  default     = "C0ADBQGHMDH"
}

variable "notion_database_id" {
  description = "Notion database ID"
  type        = string
  default     = "2a09703d-8e9c-8193-b638-f7bb6b1c7cd8"
}

variable "gmail_to" {
  description = "Email recipient for digest"
  type        = string
  default     = "market-intelligence@carrot.eco"
}

variable "schedule_expression" {
  description = "EventBridge cron expression"
  type        = string
  default     = "cron(0 10 ? * MON-FRI *)"
}
