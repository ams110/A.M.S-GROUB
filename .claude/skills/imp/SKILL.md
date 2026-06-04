---
name: imp
description: >
  Improve and optimize any prompt before executing it. Use this skill whenever the user writes a prompt, request, or task for Claude and wants it enhanced before execution. Triggers on phrases like "improve this prompt", "enhance my prompt", "optimize this request", "حسّن البرومت", "طوّر الطلب", or any variation where the user wants their input refined using prompt engineering best practices before Claude acts on it. Also trigger when the user says "imp" followed by a prompt, or wraps their request with intent to get a better version. This skill should trigger even if the user casually says things like "make this prompt better and run it", "imp this", or "حسّنه ونفذه". The final output is always: the improved prompt shown to the user, followed by the result of executing it.
---

# IMP — Prompt Improver & Executor

This skill takes any user prompt, improves it using prompt engineering best practices, then executes the improved version and returns both the enhanced prompt and the result.

## How It Works

When triggered, follow these steps in order:

### Step 1: Analyze the Original Prompt

Read the user's prompt carefully and identify:
- What is the user trying to achieve?
- What's missing or vague?
- What format/structure would improve the output?
- What context could be added?

### Step 2: Improve the Prompt

Apply these prompt engineering techniques (pick the ones that fit — don't force all of them):

**Clarity & Specificity**
- Replace vague language with precise instructions
- Add specific output format requirements if missing
- Define constraints (length, style, audience, etc.)

**Structure**
- Use XML tags to separate instructions, context, and input when the prompt has multiple parts
- Break complex tasks into numbered steps if order matters
- Add role assignment if it helps focus the response (e.g., "You are a senior data analyst...")

**Context & Motivation**
- Add the "why" behind the request — this helps Claude understand the goal and generalize
- Include audience or use-case context when relevant

**Examples**
- Add 1-2 brief examples if the desired output format isn't obvious
- Use `<example>` tags to wrap them

**Thinking & Verification**
- For complex reasoning tasks, ask Claude to think step-by-step
- For tasks with verifiable answers, add a self-check instruction

**Output Control**
- Specify format (prose, list, table, code, JSON, etc.)
- Set length expectations if important
- Request the response in a specific language if the user's prompt implies one

### Step 3: Present the Improved Prompt

Show the improved prompt to the user in a clear, labeled block. Use this format:

```
✨ البرومت المحسّن / Improved Prompt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[the improved prompt here]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Keep the language of the improved prompt matching the user's original language. If the user wrote in Arabic, improve in Arabic. If in English, improve in English.

### Step 4: Execute the Improved Prompt

Immediately after presenting the improved prompt, execute it as if the user had typed it. Show the result clearly:

```
📋 النتيجة / Result:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[the result of executing the improved prompt]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Important Guidelines

- The improvement should be meaningful, not just cosmetic. If the original prompt is already excellent, say so and execute it as-is.
- Don't over-engineer simple prompts. A short request like "translate this to French" doesn't need XML tags and role assignment — just minor refinements.
- Match the complexity of the improvement to the complexity of the task.
- Preserve the user's intent exactly. Never change what they're asking for — only improve how they're asking for it.
- If the prompt references uploaded files, images, or context from the conversation, make sure the improved prompt preserves those references.
- If other skills are more appropriate for the execution step (e.g., docx, xlsx, pptx, pdf), use them during execution.

## Examples

**Example 1: Simple prompt**

Original: "اكتبلي إيميل اعتذار"

Improved:
```
أنت كاتب محترف متخصص في التواصل المهني.

اكتب إيميل اعتذار رسمي وقصير (لا يزيد عن 150 كلمة) بالعربية الفصحى. الإيميل يجب أن:
- يبدأ بالاعتذار المباشر
- يوضح الإجراء التصحيحي
- ينتهي بنبرة إيجابية

اكتب الإيميل مع سطر الموضوع.
```

**Example 2: Complex prompt**

Original: "Help me build a landing page for my SaaS product"

Improved:
```
You are a senior frontend developer and UI/UX designer.

Create a modern, conversion-optimized landing page for a SaaS product. Include:

<requirements>
1. Hero section with a compelling headline, subheadline, and CTA button
2. Features section (3-4 key features with icons)
3. Social proof section (testimonials or stats)
4. Pricing section with at least 2 tiers
5. FAQ section
6. Footer with links
</requirements>

<design_guidelines>
- Use a unique, non-generic color palette — avoid default purple/blue gradients
- Choose distinctive typography (not Inter, Roboto, or Arial)
- Add subtle animations for scroll reveals
- Mobile-responsive layout
- Dark/light theme toggle
</design_guidelines>

Build this as a single HTML file with embedded CSS and JavaScript. Make it production-ready and visually distinctive.
```
