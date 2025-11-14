-- Fix Agent Model Names and Types to Use Valid OpenAI and Anthropic Models
-- Run this to update existing agents with correct configurations

-- Fix Operation Lead: Change to OpenAI type and set gpt-4o model
UPDATE agents 
SET type = 'openai',
    config = '{"model": "gpt-4o", "systemPrompt": "You are the Operation Lead. Orient and complete a security assessment against the designated target using the tools and agents available to you.", "flowOrder": 0}'::jsonb
WHERE name = 'Operation Lead';

-- Fix Senior Cyber Operator: Keep Anthropic type, set claude-sonnet-4-5-20250929
UPDATE agents 
SET config = '{"model": "claude-sonnet-4-5-20250929", "systemPrompt": "You are the Senior Cyber Operator. Execute penetration testing operations and adapt your strategy based on results.", "flowOrder": 1}'::jsonb
WHERE name = 'Senior Cyber Operator';

-- Fix Technical Writer: Keep OpenAI type, set gpt-4o
UPDATE agents 
SET config = '{"model": "gpt-4o", "systemPrompt": "You are a Technical Writer creating professional penetration test reports.", "flowOrder": 2}'::jsonb
WHERE name = 'Technical Writer';

-- Fix QA: Set appropriate model if needed
UPDATE agents 
SET config = '{"model": "claude-sonnet-4-5-20250929", "systemPrompt": "You are a QA agent ensuring quality and accuracy.", "flowOrder": 3}'::jsonb
WHERE name = 'QA';

-- Display updated agents
SELECT name, type, config->>'model' as model, config->>'flowOrder' as flow_order, status 
FROM agents 
ORDER BY (config->>'flowOrder')::int NULLS LAST, name;
