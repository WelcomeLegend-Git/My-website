from openai import OpenAI
import os

# IMPORTANT: Paste your actual API key here if you don't want to use environment variables.
# Example: api_key="sk-ws-H..."
API_KEY = os.getenv("DASHSCOPE_API_KEY", "paste_your_api_key_here")

client = OpenAI(
    api_key=API_KEY,
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
)

messages = [{"role": "user", "content": "Explain quantum computing in one sentence."}]

print("Sending request to Qwen...")
completion = client.chat.completions.create(
    model="qwen3.8-max",  
    messages=messages,
    extra_body={"enable_thinking": True},
    stream=True
)

is_answering = False  # Indicates whether the response phase has started
print("\n" + "=" * 20 + " Thinking process " + "=" * 20)

for chunk in completion:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    
    # Print the "thinking" (reasoning) process
    if hasattr(delta, "reasoning_content") and delta.reasoning_content is not None:
        if not is_answering:
            print(delta.reasoning_content, end="", flush=True)
            
    # Print the final answer
    if hasattr(delta, "content") and delta.content:
        if not is_answering:
            print("\n" + "=" * 20 + " Full response " + "=" * 20)
            is_answering = True
        print(delta.content, end="", flush=True)

print("\n")
