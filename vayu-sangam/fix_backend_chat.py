import re

with open('backend/app/main.py', 'rb') as f:
    content = f.read()

# Since the end of the file is UTF-16, it has null bytes. Let's decode with errors='ignore' 
# or just decode the whole file as utf-8, replace the chat endpoint, and write back.
text = content.decode('utf-8', errors='ignore')

# Remove the corrupted chat endpoint
text = re.sub(r'@app\.post\([\'"]/api/chat[\'"]\).*', '', text, flags=re.DOTALL)

# Add the new Groq endpoint
new_endpoint = """
from fastapi.responses import StreamingResponse
from fastapi import Request
import os

@app.post('/api/chat')
async def chat_endpoint(request: Request):
    data = await request.json()
    messages = data.get('messages', [])
    
    groq_key = os.environ.get('GROQ_API_KEY')
    
    if not groq_key:
        return {'error': 'API Key not found. Please set GROQ_API_KEY in your environment.'}
        
    try:
        from groq import Groq
        client = Groq(api_key=groq_key)
        
        # Enforce strong constraints
        system_constraint = {
            "role": "system",
            "content": "STRICT CONSTRAINT: You are strictly limited to answering questions related to the VayuSangam project, air quality, pollution, PM2.5, AQI, and atmospheric science in Delhi NCR. If the user asks about ANYTHING ELSE (like coding, history, casual chat, math, etc.), you MUST decline politely and state you only answer Air Quality questions. DO NOT provide general knowledge answers outside this scope."
        }
        
        # Insert constraint after the first system message, or at the start
        if messages and messages[0]['role'] == 'system':
            messages.insert(1, system_constraint)
        else:
            messages.insert(0, system_constraint)
            
        def generate():
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant", # fast and free Groq model
                messages=messages,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        return StreamingResponse(generate(), media_type='text/plain')
    except Exception as e:
        return {'error': str(e)}
"""

text = text.strip() + '\n' + new_endpoint

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated main.py with Groq")
