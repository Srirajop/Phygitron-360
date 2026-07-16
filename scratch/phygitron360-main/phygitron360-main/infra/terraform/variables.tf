variable "aws_region" {
  description = "The AWS region to deploy to"
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  default     = "phygitron360"
}

variable "db_username" {
  description = "Database master username"
  default     = "phygitron_admin"
}

variable "db_password" {
  description = "Database master password"
  sensitive   = true
}

variable "superadmin_email" {
  description = "Superadmin email for initial seeding"
}

variable "superadmin_password" {
  description = "Superadmin password for initial seeding"
  sensitive   = true
}

variable "secret_key" {
  description = "Cryptographic secret key for the backend"
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP Server Host"
  default     = ""
}

variable "smtp_port" {
  description = "SMTP Server Port"
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP Username"
  default     = ""
}

variable "smtp_pass" {
  description = "SMTP Password"
  sensitive   = true
  default     = ""
}

variable "google_api_key" {
  description = "Google API Key"
  sensitive   = true
  default     = ""
}

variable "gemini_api_keys" {
  description = "Comma-separated list of Gemini API Keys for pooling"
  sensitive   = true
  default     = ""
}

variable "gemini_rpm_limit" {
  description = "RPM limit per Gemini key"
  default     = "13"
}

variable "gemini_model" {
  description = "Gemini Model"
  default     = "gemini-3.1-flash-lite"
}

variable "openai_api_key" {
  description = "OpenAI API Key"
  sensitive   = true
  default     = ""
}

variable "groq_api_key" {
  description = "Groq API Key"
  sensitive   = true
  default     = ""
}

variable "ai_provider" {
  description = "The AI Provider (mock, gemini, openai, groq)"
  default     = "mock"
}

variable "bulk_ai_provider" {
  description = "Fallback/Bulk AI Provider for heavy tasks"
  default     = "groq"
}

variable "bulk_parse_workers" {
  description = "Number of background workers"
  default     = "2"
}

variable "groq_model" {
  description = "Groq Model"
  default     = "llama-3.1-8b-instant"
}

variable "sender_name" {
  description = "Email sender name"
  default     = "EWANDZ Digital HR"
}

variable "company_name" {
  description = "Company Name"
  default     = "EWANDZ Digital"
}
