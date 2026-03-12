# Plugins

This directory contains integrations with external tools and services that extend the
AVops Agent Team's capabilities. Each plugin lives in its own subdirectory with a
self-contained `plugin.md` descriptor.

---

## What Is a Plugin?

A plugin connects an external tool, service, or framework into the AVops 7-Agent workflow.
Plugins are **not** code libraries — they are documented integration points that describe:

- What the external tool does
- How to install and configure it
- How it fits into the agent workflow (which agent uses it, at which stage)
- Required environment variables (no secrets ever hardcoded)
- Usage examples and operational notes

---

## Available Plugins

| Plugin | Source | Purpose | Used By |
|--------|--------|---------|---------|
| [llm-council](./llm-council/plugin.md) | [karpathy/llm-council](https://github.com/karpathy/llm-council) | Multi-LLM consensus for AV troubleshooting & design decisions | Researcher, Planner |

---

## Adding a Plugin

1. Create a subdirectory: `plugins/<plugin-name>/`
2. Write a `plugin.md` following the structure in any existing plugin
3. Add an `config.example.env` for required env vars
4. Add the plugin to the table above
5. Reference the plugin in the relevant workflow file under `workflows/`
6. Add any required env var names (not values) to `.gitignore` hints in the plugin's README

**Never** commit `.env` files, API keys, or credentials.
