import re

with open('frontend/app/components/ChatbotWidget.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove MODEL_CHAIN and getPuter
content = re.sub(r'// ─── Puter\.js model fallback chain.*?function getPuter\(\) \{.*?\n  \}', '', content, flags=re.DOTALL)

# 2. Replace chatWithFallback
new_chat = '''
// ─── Streaming AI with backend ────────────────────────────────────────────────
async function chatWithFallback(
  messages: Array<{ role: string; content: string }>,
  onToken: (t: string) => void
): Promise<void> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream");
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onToken(decoder.decode(value, { stream: true }));
    }
  } catch (e: any) {
    console.error(e);
    throw new Error(`Chat API error: ${e.message}`);
  }
}
'''
content = re.sub(r'// ─── Streaming AI with fallback.*?throw new Error\(`All models failed\. Last error: \$\{lastError\?\.message\}`\);\n  \}', new_chat, content, flags=re.DOTALL)

# 3. Remove puterReady state
content = re.sub(r'const \[puterReady, setPuterReady\] = useState\(false\);\n', '', content)

# 4. Remove useEffect for puter check
content = re.sub(r'// Wait for Puter\.js\n  useEffect\(\(\) => \{\n    const check = \(\) => \{\n      if \(getPuter\(\)\) setPuterReady\(true\);\n      else setTimeout\(check, 400\);\n    \};\n    check\(\);\n', '  useEffect(() => {\n', content)

# 5. Fix UI ternary operators
content = content.replace('puterReady ? "VayuSangam Assistant" : "Loading AI..."', '"VayuSangam Assistant"')
content = content.replace('puterReady ? "Ask about air quality..." : "Loading AI..."', '"Ask about air quality..."')
content = content.replace('disabled={isLoading || !puterReady}', 'disabled={isLoading}')
content = content.replace('disabled={isLoading || !puterReady || !input.trim()}', 'disabled={isLoading || !input.trim()}')

# 6. Footer text
content = content.replace('Powered by Puter.js · VayuSangam only', 'Powered by VayuSangam AI')

with open('frontend/app/components/ChatbotWidget.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
