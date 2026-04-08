import { anthropic } from "@ai-sdk/anthropic";
import {
  LanguageModelV1,
  LanguageModelV1StreamPart,
  LanguageModelV1Message,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly defaultObjectGenerationMode = "tool" as const;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: LanguageModelV1Message[]): string {
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          // Extract text from content parts
          const textParts = content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text);
          return textParts.join(" ");
        } else if (typeof content === "string") {
          return content;
        }
      }
    }
    return "";
  }

  private getLastToolResult(messages: LanguageModelV1Message[]): any {
    // Find the last tool message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "tool") {
        const content = messages[i].content;
        if (Array.isArray(content) && content.length > 0) {
          return content[0];
        }
      }
    }
    return null;
  }

  private async *generateMockStream(
    messages: LanguageModelV1Message[],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV1StreamPart> {
    // Count tool messages to determine which step we're on
    const toolMessageCount = messages.filter((m) => m.role === "tool").length;

    // Determine component type from the original user prompt
    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("pricing")) {
      componentType = "pricing";
      componentName = "PricingCard";
    } else if (promptLower.includes("card")) {
      componentType = "card";
      componentName = "Card";
    }

    // Step 1: Create component file
    if (toolMessageCount === 1) {
      const text = `I'll create a ${componentName} component for you.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_1`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: `/components/${componentName}.jsx`,
          file_text: this.getComponentCode(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 2: Enhance component
    if (toolMessageCount === 2) {
      const text = `Now let me enhance the component with better styling.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_2`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "str_replace",
          path: `/components/${componentName}.jsx`,
          old_str: this.getOldStringForReplace(componentType),
          new_str: this.getNewStringForReplace(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 3: Create App.jsx
    if (toolMessageCount === 0) {
      const text = `This is a static response. You can place an Anthropic API key in the .env file to use the Anthropic API for component generation. Let me create an App.jsx file to display the component.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(15);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_3`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: "/App.jsx",
          file_text: this.getAppCode(componentName),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 4: Final summary (no tool call)
    if (toolMessageCount >= 3) {
      const text = `Perfect! I've created:

1. **${componentName}.jsx** - A fully-featured ${componentType} component
2. **App.jsx** - The main app file that displays the component

The component is now ready to use. You can see the preview on the right side of the screen.`;

      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(30);
      }

      yield {
        type: "finish",
        finishReason: "stop",
        usage: {
          promptTokens: 50,
          completionTokens: 50,
        },
      };
      return;
    }
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl">✓</div>
        <h3 className="text-xl font-bold text-white">Message sent!</h3>
        <p className="text-slate-400 text-sm">We'll get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-1">Get in touch</h2>
      <p className="text-slate-400 text-sm mb-8">We read every message and respond within 24 hours.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">Name</label>
          <input
            type="text" name="name" value={formData.name} onChange={handleChange} required
            placeholder="Jane Smith"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">Email</label>
          <input
            type="email" name="email" value={formData.email} onChange={handleChange} required
            placeholder="jane@company.com"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">Message</label>
          <textarea
            name="message" value={formData.message} onChange={handleChange} required rows={4}
            placeholder="Tell us what's on your mind..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-500 transition-colors"
        >
          Send message →
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `const Card = () => {
  return (
    <div className="relative bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl overflow-hidden shadow-xl shadow-violet-900/40 max-w-sm">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent" />
      <div className="relative p-8">
        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-violet-200 bg-white/10 px-3 py-1 rounded-full mb-6">
          Featured
        </span>
        <h3 className="text-2xl font-bold text-white mb-3 leading-tight">
          Streamline your workflow today
        </h3>
        <p className="text-violet-200 text-sm leading-relaxed mb-8">
          Everything your team needs to move faster — built for modern product teams who ship.
        </p>
        <button className="w-full bg-white text-violet-700 font-semibold py-3 rounded-xl hover:bg-violet-50 transition-colors">
          Get started free
        </button>
      </div>
    </div>
  );
};

export default Card;`;

      case "pricing":
        return `const tiers = [
  {
    name: "Starter",
    price: "$9",
    description: "Perfect for side projects and indie hackers.",
    features: ["5 projects", "10GB storage", "Community support", "API access"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    description: "For growing teams that need more power.",
    features: ["Unlimited projects", "100GB storage", "Priority support", "Advanced analytics", "Custom domains"],
    cta: "Get started",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    description: "Dedicated infrastructure for large teams.",
    features: ["Everything in Pro", "1TB storage", "24/7 dedicated support", "SSO & SAML", "SLA guarantee"],
    cta: "Contact sales",
    highlight: false,
  },
];

const PricingCard = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className={
            tier.highlight
              ? "relative bg-gradient-to-b from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-xl shadow-emerald-900/30 text-white"
              : "relative bg-slate-800 border border-slate-700 rounded-2xl p-6 text-slate-100"
          }
        >
          {tier.highlight && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full">
              Most popular
            </span>
          )}
          <p className="text-sm font-semibold tracking-widest uppercase opacity-70 mb-2">{tier.name}</p>
          <p className="text-4xl font-black mb-1">{tier.price}<span className="text-base font-normal opacity-60">/mo</span></p>
          <p className="text-sm opacity-70 mb-6">{tier.description}</p>
          <ul className="space-y-2 mb-8">
            {tier.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className={tier.highlight ? "text-emerald-100" : "text-emerald-400"}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            className={
              tier.highlight
                ? "w-full bg-white text-emerald-700 font-semibold py-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
                : "w-full border border-slate-600 text-slate-100 font-semibold py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
            }
          >
            {tier.cta}
          </button>
        </div>
      ))}
    </div>
  );
};

export default PricingCard;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8 p-12 bg-slate-900 rounded-2xl">
      <h2 className="text-sm font-semibold tracking-widest uppercase text-slate-400">Counter</h2>
      <div className="text-8xl font-black text-white tabular-nums">{count}</div>
      <div className="flex gap-3">
        <button
          onClick={() => setCount((prev) => prev - 1)}
          className="w-12 h-12 rounded-xl bg-slate-700 text-white text-xl font-bold hover:bg-rose-500 transition-colors"
        >
          −
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-5 h-12 rounded-xl border border-slate-600 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setCount((prev) => prev + 1)}
          className="w-12 h-12 rounded-xl bg-slate-700 text-white text-xl font-bold hover:bg-emerald-500 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    setSubmitted(true);";
      case "card":
        return '        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-violet-200 bg-white/10 px-3 py-1 rounded-full mb-6">';
      case "pricing":
        return '  {tiers.map((tier) => (';
      default:
        return '          className="w-12 h-12 rounded-xl bg-slate-700 text-white text-xl font-bold hover:bg-rose-500 transition-colors"';
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    setSubmitted(true);\n    setFormData({ name: '', email: '', message: '' });";
      case "card":
        return '        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-violet-200 bg-white/10 px-3 py-1 rounded-full mb-6 ring-1 ring-white/20">';
      case "pricing":
        return '  {tiers.map((tier) => (\n    // Each tier card';
      default:
        return '          className="w-12 h-12 rounded-xl bg-slate-700 text-white text-xl font-bold hover:bg-rose-500 transition-colors active:scale-95"';
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "PricingCard") {
      return `import PricingCard from '@/components/PricingCard';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <PricingCard />
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <${componentName} />
    </div>
  );
}`;
  }

  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);

    // Collect all stream parts
    const parts: LanguageModelV1StreamPart[] = [];
    for await (const part of this.generateMockStream(
      options.prompt,
      userPrompt
    )) {
      parts.push(part);
    }

    // Build response from parts
    const textParts = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as any).textDelta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => ({
        toolCallType: "function" as const,
        toolCallId: (p as any).toolCallId,
        toolName: (p as any).toolName,
        args: (p as any).args,
      }));

    // Get finish reason from finish part
    const finishPart = parts.find((p) => p.type === "finish") as any;
    const finishReason = finishPart?.finishReason || "stop";

    return {
      text: textParts,
      toolCalls,
      finishReason: finishReason as any,
      usage: {
        promptTokens: 100,
        completionTokens: 200,
      },
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        },
      },
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        try {
          const generator = self.generateMockStream(options.prompt, userPrompt);
          for await (const chunk of generator) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {},
      },
      rawResponse: { headers: {} },
    };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-sonnet-4-0");
  }

  return anthropic(MODEL);
}
