output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.pipeline.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "s3_bucket_name" {
  description = "S3 bucket for pipeline state"
  value       = aws_s3_bucket.state.id
}

output "eventbridge_rule_name" {
  description = "EventBridge rule name"
  value       = aws_cloudwatch_event_rule.daily_trigger.name
}
