import asyncio
from app.llm_provider import create_stream, groq_stream
import sys

def test_groq():
    print("Testing raw groq_stream:")
    try:
        for chunk in groq_stream("Hello, say 'test'"):
            sys.stdout.write(chunk)
            sys.stdout.flush()
    except Exception as e:
        print(f"Error: {e}")

    print("\n\nTesting create_stream:")
    try:
        for chunk in create_stream("Hello, say 'test'"):
            sys.stdout.write(chunk)
            sys.stdout.flush()
    except Exception as e:
        print(f"Error: {e}")
    print("\nDone.")

if __name__ == "__main__":
    test_groq()
