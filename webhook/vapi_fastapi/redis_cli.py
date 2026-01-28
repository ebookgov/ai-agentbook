import os
import sys
import asyncio
import shlex
import redis.asyncio as redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Config
REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    print("❌ Error: REDIS_URL not found in environment variables.")
    print("   Please set REDIS_URL in your .env file or environment.")
    sys.exit(1)

async def execute_command(client, cmd_parts):
    if not cmd_parts:
        return
    
    command = cmd_parts[0].lower()
    args = cmd_parts[1:]
    
    try:
        if command == "ping":
            result = await client.ping()
            print("PONG" if result else "Failed")
        elif command == "get":
            if len(args) != 1:
                print("Usage: get <key>")
                return
            val = await client.get(args[0])
            print(val if val is not None else "(nil)")
        elif command == "set":
            if len(args) < 2:
                print("Usage: set <key> <value> [ex seconds]")
                return
            # Simple set handling
            keyword_args = {}
            if len(args) == 4 and args[2].lower() == "ex":
                keyword_args["ex"] = int(args[3])
                await client.set(args[0], args[1], **keyword_args)
            else:
                await client.set(args[0], args[1])
            print("OK")
        elif command == "del":
            if not args:
                print("Usage: del <key> ...")
                return
            count = await client.delete(*args)
            print(f"(integer) {count}")
        elif command == "keys":
            pattern = args[0] if args else "*"
            keys = await client.keys(pattern)
            if not keys:
                print("(empty list or set)")
            else:
                for k in keys:
                    print(f'"{k}"')
        elif command == "flushdb":
            await client.flushdb()
            print("OK")
        elif command == "exit" or command == "quit":
            return "EXIT"
        else:
            # Fallback to generic execute_command if method exists or try raw
            try:
                # Dynamic dispatch for other commands
                cmd_method = getattr(client, command, None)
                if cmd_method:
                    res = await cmd_method(*args)
                    print(res)
                else:
                    # Try execute_command interface
                    res = await client.execute_command(command, *args)
                    print(res)
            except Exception as e:
                print(f"(error) {str(e)}")
                
    except Exception as e:
        print(f"(error) {str(e)}")

async def main():
    print(f"🔌 Connecting to Redis...")
    
    try:
        client = redis.from_url(
            REDIS_URL, 
            encoding="utf-8", 
            decode_responses=True
        )
        await client.ping()
        print(f"✅ Connected to {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else 'Redis'}")
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return

    # If arguments provided, run single command
    if len(sys.argv) > 1:
        await execute_command(client, sys.argv[1:])
        await client.close()
        return

    # Interactive Mode
    print("🚀 Entering Interactive Mode (type 'exit' to quit)")
    print("--------------------------------------------------")
    
    while True:
        try:
            line = input(f"redis> ")
            if not line.strip():
                continue
            
            parts = shlex.split(line)
            result = await execute_command(client, parts)
            
            if result == "EXIT":
                break
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}")

    await client.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
