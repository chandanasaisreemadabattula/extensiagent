-- ExtensiAgent Version 2 - Database Schema
-- This migration creates tables for AI-powered version scoring, trust history, and analytics

-- Table: extension_versions
-- Stores version-level information and AI scores
CREATE TABLE IF NOT EXISTS extension_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id TEXT NOT NULL, -- e.g., "publisher.extensionName"
  version TEXT NOT NULL,
  release_notes TEXT,
  release_date TIMESTAMP WITH TIME ZONE,
  ai_version_score INTEGER CHECK (ai_version_score >= 0 AND ai_version_score <= 100),
  change_impact TEXT CHECK (change_impact IN ('major', 'minor', 'patch', 'breaking', 'deprecation')),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(extension_id, version)
);

-- Table: trust_scores_history
-- Stores historical trust scores for trend analysis
CREATE TABLE IF NOT EXISTS trust_scores_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id TEXT NOT NULL,
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  permissions_score INTEGER CHECK (permissions_score >= 0 AND permissions_score <= 100),
  community_score INTEGER CHECK (community_score >= 0 AND community_score <= 100),
  ai_version_score INTEGER CHECK (ai_version_score >= 0 AND ai_version_score <= 100),
  security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
  downloads INTEGER,
  rating DECIMAL(3,2),
  rating_count INTEGER,
  publisher_verified BOOLEAN,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: extension_metadata
-- Stores current extension metadata from marketplace
CREATE TABLE IF NOT EXISTS extension_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  publisher_verified BOOLEAN DEFAULT FALSE,
  short_description TEXT,
  latest_version TEXT,
  latest_version_date TIMESTAMP WITH TIME ZONE,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  categories TEXT[],
  tags TEXT[],
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: security_assessments
-- Stores security risk assessments for extensions
CREATE TABLE IF NOT EXISTS security_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id TEXT NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  permissions_analysis JSONB,
  publisher_trust_score INTEGER CHECK (publisher_trust_score >= 0 AND publisher_trust_score <= 100),
  malware_indicators TEXT[],
  suspicious_patterns TEXT[],
  recommendations TEXT[],
  assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(extension_id)
);

-- Table: user_extension_profiles
-- Stores user's extension preferences and history for personalized recommendations
CREATE TABLE IF NOT EXISTS user_extension_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Could be VS Code user ID or anonymous ID
  installed_extensions TEXT[],
  preferred_categories TEXT[],
  tech_stack TEXT[],
  coding_patterns JSONB,
  last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table: extension_recommendations
-- Stores personalized recommendations for users
CREATE TABLE IF NOT EXISTS extension_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  recommendation_type TEXT CHECK (recommendation_type IN ('alternative', 'complementary', 'trending', 'must_have', 'security_upgrade')),
  reason TEXT,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  based_on TEXT[], -- What factors led to this recommendation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, extension_id, recommendation_type)
);

-- Table: extension_insights
-- Stores AI-generated insights and analytics
CREATE TABLE IF NOT EXISTS extension_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id TEXT NOT NULL,
  insight_type TEXT CHECK (insight_type IN ('trend', 'prediction', 'category', 'maintenance', 'popularity')),
  insight_text TEXT NOT NULL,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  supporting_data JSONB,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_extension_versions_extension_id ON extension_versions(extension_id);
CREATE INDEX IF NOT EXISTS idx_extension_versions_release_date ON extension_versions(release_date);
CREATE INDEX IF NOT EXISTS idx_trust_scores_history_extension_id ON trust_scores_history(extension_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_history_recorded_at ON trust_scores_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_extension_metadata_extension_id ON extension_metadata(extension_id);
CREATE INDEX IF NOT EXISTS idx_security_assessments_extension_id ON security_assessments(extension_id);
CREATE INDEX IF NOT EXISTS idx_user_extension_profiles_user_id ON user_extension_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_recommendations_user_id ON extension_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_insights_extension_id ON extension_insights(extension_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_extension_versions_updated_at BEFORE UPDATE ON extension_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extension_metadata_updated_at BEFORE UPDATE ON extension_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_extension_profiles_updated_at BEFORE UPDATE ON user_extension_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
