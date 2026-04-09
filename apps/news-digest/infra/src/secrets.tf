resource "aws_secretsmanager_secret" "carbon_pulse" {
  name        = "${var.app_name}/carbon-pulse"
  description = "Carbon Pulse login credentials"
  tags        = { Name = "${var.app_name}/carbon-pulse", Purpose = "Web scraping authentication" }
}

resource "aws_secretsmanager_secret" "slack_token" {
  name        = "${var.app_name}/slack-token"
  description = "Slack bot OAuth token"
  tags        = { Name = "${var.app_name}/slack-token", Purpose = "Slack digest posting" }
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name        = "${var.app_name}/anthropic-api-key"
  description = "Anthropic Claude API key"
  tags        = { Name = "${var.app_name}/anthropic-api-key", Purpose = "Article AI processing" }
}

resource "aws_secretsmanager_secret" "notion_token" {
  name        = "${var.app_name}/notion-token"
  description = "Notion integration token"
  tags        = { Name = "${var.app_name}/notion-token", Purpose = "Notion page creation" }
}

resource "aws_secretsmanager_secret" "gmail_credentials" {
  name        = "${var.app_name}/gmail-credentials"
  description = "Gmail OAuth2 credentials"
  tags        = { Name = "${var.app_name}/gmail-credentials", Purpose = "Gmail draft creation" }
}

resource "aws_secretsmanager_secret" "proxy" {
  name        = "${var.app_name}/proxy"
  description = "Residential proxy credentials for Cloudflare bypass"
  tags        = { Name = "${var.app_name}/proxy", Purpose = "Proxy for web scraping" }
}
