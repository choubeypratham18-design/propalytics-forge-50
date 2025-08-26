import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    // Using a simple search API - you can replace with your preferred search provider
    const searchQuery = encodeURIComponent(query);
    const searchUrl = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Extract relevant results
    const results: SearchResult[] = [];
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            snippet: topic.Text,
            link: topic.FirstURL
          });
        }
      });
    }
    
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

async function generateAIResponse(userMessage: string, searchResults: SearchResult[]): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const searchContext = searchResults.length > 0 
    ? `\n\nRecent information from web search:\n${searchResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}`
    : '';

  const systemPrompt = `You are an intelligent AI assistant with access to real-time information. You specialize in providing accurate, helpful, and up-to-date responses.

Key instructions:
- Provide detailed, informative responses
- Use real-time information when available
- Be conversational and helpful
- Include relevant links or sources when appropriate
- Support both English and Hindi languages
- Format responses clearly with proper structure

${searchContext}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, includeSearch = true } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing query:', message);

    // Determine if we should search for real-time information
    let searchResults: SearchResult[] = [];
    
    if (includeSearch) {
      // Check if query needs real-time information
      const needsSearch = /\b(current|latest|recent|today|now|price|news|weather|2024|2025)\b/i.test(message) ||
                         /\b(market|stock|crypto|exchange rate|temperature)\b/i.test(message);
      
      if (needsSearch) {
        console.log('Searching for real-time information...');
        searchResults = await searchWeb(message);
        console.log('Search results:', searchResults.length);
      }
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(message, searchResults);

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: searchResults.length > 0 ? searchResults : null,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-assistant function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      fallback: 'Sorry, I encountered an error while processing your request. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});