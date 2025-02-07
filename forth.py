from dotenv import load_dotenv
import os
from termcolor import colored
from anthropic import Anthropic
import aiohttp
import asyncio
import json
import time
from typing import Optional, Dict, List

# Load environment variables
load_dotenv()

class AICollaborationSystem:
    def __init__(self):
        self.openrouter_key = os.getenv('OPENROUTER_API_KEY')
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.anthropic_client = Anthropic(api_key=self.anthropic_key)
        self.max_iterations = 5
        self.conversation_history: List[Dict] = []
        self.workflow_state = 'INITIAL'
        self.openrouter_api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.last_request_time = 0
        self.min_request_interval = 12  # 60/5 seconds between requests (5 requests per minute)
        self.storage_path = os.path.join(os.path.dirname(__file__), 'data')
        
    async def initialize(self) -> None:
        """Initialize the system with enhanced features"""
        print(colored("\n=== AI Collaboration System Initializing... ===", "blue"))
        
        # Verify API keys
        if not self.openrouter_key:
            raise ValueError("Missing OPENROUTER_API_KEY")
        if not self.anthropic_key:
            raise ValueError("Missing ANTHROPIC_API_KEY")
            
        # Create storage directory if it doesn't exist
        os.makedirs(self.storage_path, exist_ok=True)
        
        # Load conversation history
        await self._load_conversation_history()
        
        print(colored("✓ API keys verified", "green"))
        print(colored("✓ Storage initialized", "green"))
        print(colored("=== System Ready ===\n", "blue"))

    async def _load_conversation_history(self):
        """Load conversation history from storage"""
        history_file = os.path.join(self.storage_path, 'conversation_history.json')
        try:
            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    self.conversation_history = json.load(f)
        except Exception as e:
            print(colored(f"Warning: Could not load conversation history: {e}", "yellow"))
            self.conversation_history = []

    async def _save_conversation_history(self):
        """Save conversation history to storage"""
        history_file = os.path.join(self.storage_path, 'conversation_history.json')
        try:
            with open(history_file, 'w') as f:
                json.dump(self.conversation_history[-10:], f)  # Keep last 10 conversations
        except Exception as e:
            print(colored(f"Warning: Could not save conversation history: {e}", "yellow"))

    def _get_cot_template(self) -> Dict:
        """Get the Chain of Thought template with special tokens"""
        return {
            "tokens": {
                "reasoning": "[THINK]",
                "verification": "[VERIFY]",
                "conclusion": "[CONCLUDE]",
                "reflection": "[REFLECT]"
            },
            "template": """
                [THINK]
                1. Initial Problem Analysis
                2. Approach Identification
                3. Step-by-step Solution
                
                [VERIFY]
                1. Solution Correctness
                2. Edge Cases
                3. Performance Considerations
                
                [REFLECT]
                1. Alternative Approaches
                2. Trade-offs
                3. Learning Points
                
                [CONCLUDE]
                Final solution with key insights
            """
        }

    async def _make_api_request(self, request_data: Dict, attempt: int = 1, max_attempts: int = 3) -> Optional[Dict]:
        """Make API request with retry logic and improved error handling"""
        try:
            # Rate limiting
            current_time = time.time()
            time_since_last_request = current_time - self.last_request_time
            if time_since_last_request < self.min_request_interval:
                await asyncio.sleep(self.min_request_interval - time_since_last_request)
            
            print(colored(f"\n[Debug] Making API request (Attempt {attempt}/{max_attempts})", "cyan"))
            
            # Add enhanced system prompt with CoT template
            if 'messages' in request_data:
                cot_template = self._get_cot_template()
                system_message = {
                    "role": "system",
                    "content": f"""You are a precise problem solver that uses structured thinking.
                    Follow this format for your response:
                    {cot_template['template']}
                    
                    Important guidelines:
                    1. Take time to think deeply before answering
                    2. Show all steps of your reasoning
                    3. Verify your solution before concluding
                    4. Reflect on alternative approaches
                    5. Use markdown formatting for clarity
                    """
                }
                request_data['messages'].insert(0, system_message)
            
            # Prepare request for OpenRouter API
            headers = {
                "Authorization": f"Bearer {self.openrouter_key}",
                "HTTP-Referer": "https://github.com/your-repo",  # Replace with your app's URL
                "X-Title": "AI Collaboration System",  # Your app's name
                "Content-Type": "application/json"
            }
            
            # Update request data for OpenRouter API format
            api_request = {
                "messages": request_data.get('messages', []),
                "model": "deepseek/deepseek-r1-distill-llama-70b",  # DeepSeek R1 Distill model
                "temperature": request_data.get('temperature', 0.7),
                "max_tokens": request_data.get('max_tokens', 2000),
                "top_p": request_data.get('top_p', 0.95),
                "stream": False
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.openrouter_api_url,
                    headers=headers,
                    json=api_request
                ) as response:
                    self.last_request_time = time.time()  # Update last request time
                    
                    if response.status != 200:
                        error_text = await response.text()
                        print(colored(f"API Error (Attempt {attempt}/{max_attempts}): {error_text}", "red"))
                        if attempt < max_attempts:
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                            return await self._make_api_request(request_data, attempt + 1, max_attempts)
                        return {"error": f"API request failed after {max_attempts} attempts"}
                    
                    return await response.json()
        
        except Exception as e:
            print(colored(f"\n[Error] {str(e)}", "red"))
            
        if attempt < max_attempts:
            wait_time = min(2 ** attempt, 10)
            print(colored(f"Retrying in {wait_time}s...", "yellow"))
            await asyncio.sleep(wait_time)
            return await self._make_api_request(request_data, attempt + 1, max_attempts)
        
        return None

    async def _extract_thinking_steps(self, response_data: Dict) -> Dict:
        """Extract and structure the model's thinking steps from the response"""
        try:
            if not response_data or 'choices' not in response_data:
                return {"error": "Invalid response data"}
            
            response_text = response_data['choices'][0]['message']['content']
            cot_tokens = self._get_cot_template()['tokens']
            
            # Extract sections using special tokens
            sections = {}
            current_section = None
            current_content = []
            
            for line in response_text.split('\n'):
                line = line.strip()
                if not line:
                    continue
                
                # Check for section markers
                is_section = False
                for section_name, token in cot_tokens.items():
                    if token in line:
                        if current_section and current_content:
                            sections[current_section] = '\n'.join(current_content)
                        current_section = section_name
                        current_content = []
                        is_section = True
                        break
                
                if not is_section and current_section:
                    current_content.append(line)
            
            # Add the last section
            if current_section and current_content:
                sections[current_section] = '\n'.join(current_content)
            
            # Structure the thinking process
            thinking_process = {
                "raw_response": response_text,
                "structured_sections": sections,
                "meta": {
                    "has_verification": "verification" in sections,
                    "has_reflection": "reflection" in sections,
                    "reasoning_depth": len(sections.get("reasoning", "").split('\n')),
                    "timestamp": time.time()
                }
            }
            
            return thinking_process
            
        except Exception as e:
            print(colored(f"Error extracting thinking steps: {e}", "red"))
            return {"error": str(e)}

    async def _get_user_input(self) -> Optional[Dict]:
        """Get user input with optional file attachments"""
        print(colored("\n[User] Enter your query/question/request (or type 'exit'):", "yellow"))
        query = input("> ").strip()
        
        if query.lower() == 'exit':
            return None
            
        print(colored("\n[System] Would you like to attach any files/images? (y/n)", "cyan"))
        if input("> ").lower() == 'y':
            files = await self._handle_file_upload()
            return {'text': query, 'files': files}
            
        return {'text': query, 'files': []}

    async def _handle_file_upload(self) -> List[Dict]:
        """Handle file uploads with proper error handling"""
        files = []
        print(colored("\n[System] Enter file paths (comma-separated):", "cyan"))
        paths = input("> ").strip().split(',')
        
        for path in paths:
            path = path.strip()
            try:
                if not os.path.exists(path):
                    print(colored(f"File not found: {path}", "red"))
                    continue
                    
                if os.path.getsize(path) > 10 * 1024 * 1024:  
                    print(colored(f"File too large: {path}", "red"))
                    continue
                    
                with open(path, 'rb') as f:
                    content = f.read()
                    files.append({
                        'name': os.path.basename(path),
                        'content': content,
                        'mime': self._get_mime_type(path)
                    })
                    
            except Exception as e:
                print(colored(f"Error processing {path}: {str(e)}", "red"))
                
        return files

    def _get_mime_type(self, path: str) -> str:
        """Get MIME type for a file"""
        ext = os.path.splitext(path)[1].lower()
        return {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain'
        }.get(ext, 'application/octet-stream')

    async def _get_engineer_solution(self, query: Dict) -> Optional[str]:
        """Get solution from Engineer using First Principles with enhanced thinking capture"""
        try:
            # Extract previous review if this is a revision
            previous_review = None
            if 'Previous solution:' in query.get('text', ''):
                for item in reversed(self.conversation_history):
                    if item.get('review'):
                        previous_review = item['review']
                        break

            # Construct prompt with review feedback
            prompt = f"""Acting as a Senior Software Engineer, analyze this problem using first principles.
            
            {'IMPORTANT - Address these review points from the previous iteration:' + previous_review if previous_review else ''}
            
            Query: {query.get('text', '')}
            
            Follow these guidelines:
            1. If this is a revision, explicitly address EACH point from the previous review
            2. Verify your solution against the review checklist before submitting
            3. Include error handling and edge cases
            4. Consider performance and browser compatibility
            5. Provide complete, runnable code"""

            request_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "model": "deepseek/deepseek-r1-distill-llama-70b",
            }
            
            response = await self._make_api_request(request_data)
            if response:
                # Extract and store thinking steps
                thinking_process = await self._extract_thinking_steps(response)
                
                # Add thinking process to conversation history with review tracking
                self.conversation_history.append({
                    "type": "engineer_solution",
                    "query": query,
                    "response": response,
                    "thinking_process": thinking_process,
                    "previous_review": previous_review,
                    "addressed_feedback": bool(previous_review),
                    "timestamp": time.time()
                })
                
                # Display thinking steps for debugging
                if thinking_process.get("structured_sections"):
                    print(colored("\n=== Model's Thinking Process ===", "cyan"))
                    for section_name, section_content in thinking_process["structured_sections"].items():
                        print(colored(f"\n{section_name}:", "yellow"))
                        print(section_content)
                
                return response['choices'][0]['message']['content']
                
            return "Could not generate a solution at this time."
            
        except Exception as e:
            print(colored(f"Error in engineer solution: {e}", "red"))
            return str(e)

    async def _get_architect_review(self, solution: str) -> Optional[str]:
        """Get review from the Architect with enhanced critical analysis"""
        try:
            # Get previous reviews to check if issues were addressed
            previous_reviews = []
            for item in reversed(self.conversation_history[-3:]):  # Look at last 3 iterations
                if item.get('review'):
                    previous_reviews.append(item['review'])

            review_context = ""
            if previous_reviews:
                review_context = "\n\nPrevious review history:\n" + "\n".join(
                    f"Review {i+1}:\n{review}" 
                    for i, review in enumerate(reversed(previous_reviews))
                )

            async with asyncio.timeout(30):
                response = await asyncio.to_thread(
                    self.anthropic_client.messages.create,
                    model="claude-3-5-sonnet-20240620",
                    max_tokens=1500,
                    temperature=0.1,  # Optimal for precise auditing
                    messages=[{
                        "role": "user",
                        "content": f"""You are a CRITICAL CODE REVIEWER. Your task is to find ALL potential issues BEFORE the code is tested.
                        
REVIEW CHECKLIST:

1. IMMEDIATE BREAKING ISSUES
   - Syntax errors
   - Missing dependencies
   - Browser compatibility issues
   - CORS and security issues
   - Memory leaks and performance bottlenecks
   
2. IMPLEMENTATION FLAWS
   - Edge cases not handled
   - Resource management issues
   - Error handling gaps
   - Race conditions
   - Memory management

3. PRACTICAL CONCERNS
   - Loading times and performance
   - Browser compatibility
   - Mobile responsiveness
   - Network conditions
   - User experience issues

4. SPECIFIC IMPROVEMENTS
   Instead of saying "error handling could be improved", provide exact code:
   ```
   // Before
   fetch(url).then(...)
   
   // After
   try {{
     const response = await fetch(url);
     if (!response.ok) throw new Error(`HTTP error! status: ${{response.status}}`);
     // ... rest of the code
   }} catch (e) {{
     console.error('Fetch failed:', e);
     // Handle specific error types
   }}
   ```

Solution to review:
{solution}

{review_context}

IMPORTANT GUIDELINES:
1. Check if previous review points were addressed
2. If same issues persist, mark them as RECURRING
3. Provide specific, actionable feedback
4. Include code examples for improvements

FORMAT YOUR RESPONSE AS:
[CRITICAL ISSUES]
- Must be fixed immediately
- Show exact code fixes
- Mark RECURRING issues

[POTENTIAL PROBLEMS]
- May cause issues in production
- Provide specific scenarios

[IMPROVEMENTS]
- Better practices
- Example code included

[VERDICT]
APPROVED or NEEDS_REVISION with specific requirements"""
                    }]
                )
                return response.content[0].text
        except Exception as e:
            print(colored(f"\n[Error] Architect review failed: {str(e)}", "red"))
            return None

    async def process_query(self, query: Dict) -> None:
        """Process a user query through the workflow"""
        self.workflow_state = 'PROCESSING'
        iteration = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            print(colored(f"\n[Engineer] Iteration {iteration}: Analyzing...", "magenta"))
            
            # Engineer Phase
            solution = await self._get_engineer_solution(query)
            if not solution:
                print(colored("\nFailed to get solution from Engineer", "red"))
                continue
            
            print(colored("\n[Engineer's Solution]", "green"))
            print(solution)
            
            # Update state
            self.workflow_state = 'ENGINEER_COMPLETE'
            
            # Architect Phase
            print(colored("\n[Architect] Reviewing solution...", "magenta"))
            review = await self._get_architect_review(solution)
            if not review:
                print(colored("\nFailed to get review from Architect", "red"))
                continue
                
            print(colored("\n[Architect's Review]", "blue"))
            print(review)
            
            # Update state
            self.workflow_state = 'ARCHITECT_COMPLETE'
            
            # User Phase
            print(colored("\n[System] Accept this solution? (y/n/revise)", "cyan"))
            response = input("> ").lower()
            
            if response == 'y':
                # Save to history
                conversation = {
                    'timestamp': time.time(),
                    'query': query,
                    'solution': solution,
                    'review': review,
                    'workflow_state': 'COMPLETED'
                }
                self.conversation_history.append(conversation)
                await self._save_conversation_history()
                return
            elif response == 'n':
                break
            else:
                self.workflow_state = 'REVISION_NEEDED'
                query['text'] = f"Previous solution: {solution}\nRevision request: {response}\nOriginal query: {query['text']}"
        
        print(colored("\n[System] Maximum iterations reached", "red"))

    async def run(self) -> None:
        """Main execution loop"""
        try:
            await self.initialize()
            
            while True:
                query = await self._get_user_input()
                if not query:
                    break
                    
                await self.process_query(query)
                
        except KeyboardInterrupt:
            print(colored("\nGracefully shutting down...", "yellow"))
        except Exception as e:
            print(colored(f"\nError: {str(e)}", "red"))
        finally:
            print(colored("\nSession ended.", "blue"))

async def main():
    system = AICollaborationSystem()
    await system.run()

if __name__ == "__main__":
    asyncio.run(main())