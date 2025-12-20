"use client";

import { completeCommand, executeCommandStream } from "@/lib/tauri";
import { useEffect, useRef, useState } from "react";

interface TerminalLine {
  type: "input" | "output" | "error";
  content: string;
}

export default function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "output", content: "Menubar Terminal v0.1.0" },
    { type: "output", content: "Type a command and press Enter to execute." },
    { type: "output", content: "Press Tab for command completion." },
    { type: "output", content: "" },
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [completions, setCompletions] = useState<string[]>([]);
  const [completionIndex, setCompletionIndex] = useState(-1);
  const [currentOutputLine, setCurrentOutputLine] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentOutputRef = useRef<string>("");

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new lines are added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const handleTabCompletion = async (input: string) => {
    // Extract the current word being typed
    const words = input.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || "";
    const prefix = lastWord;

    if (prefix.length === 0) {
      return;
    }

    try {
      const matches = await completeCommand(prefix);
      if (matches.length === 0) {
        return;
      }

      if (matches.length === 1) {
        // Single match - auto-complete
        const newWords = [...words];
        newWords[newWords.length - 1] = matches[0];
        setCurrentInput(newWords.join(" ") + " ");
        setCompletions([]);
      } else {
        // Multiple matches - show suggestions
        setCompletions(matches);
        setCompletionIndex(0);

        // Show completions in terminal
        setLines((prev) => [
          ...prev,
          {
            type: "output",
            content: `Completions: ${matches.join("  ")}`,
          },
        ]);
      }
    } catch (error) {
      console.error("Completion error:", error);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear completion timeout
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    if (e.key === "Enter" && !isExecuting) {
      e.preventDefault();
      setCompletions([]);
      setCompletionIndex(-1);
      await executeCurrentCommand();
    } else if (e.key === "Tab") {
      e.preventDefault();
      await handleTabCompletion(currentInput);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (completions.length > 0) {
        // Navigate completions
        const newIndex =
          completionIndex <= 0 ? completions.length - 1 : completionIndex - 1;
        setCompletionIndex(newIndex);
      } else if (commandHistory.length > 0) {
        // Navigate history
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (completions.length > 0) {
        // Navigate completions
        const newIndex =
          completionIndex >= completions.length - 1 ? 0 : completionIndex + 1;
        setCompletionIndex(newIndex);
      } else if (historyIndex >= 0) {
        // Navigate history
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex >= commandHistory.length - 1) {
          setHistoryIndex(-1);
          setCurrentInput("");
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    } else {
      // Clear completions when typing
      setCompletions([]);
      setCompletionIndex(-1);
    }
  };

  const executeCurrentCommand = async () => {
    const command = currentInput.trim();
    if (!command) return;

    setIsExecuting(true);

    // Add command to history
    const newHistory = [...commandHistory, command];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    // Add command to output
    setLines((prev) => [...prev, { type: "input", content: `$ ${command}` }]);

    // Clear input
    setCurrentInput("");

    try {
      // Parse command and arguments with support for quoted strings
      const parseCommand = (input: string): { cmd: string; args: string[] } => {
        const parts: string[] = [];
        let current = "";
        let inQuotes = false;
        let quoteChar = "";

        for (let i = 0; i < input.length; i++) {
          const char = input[i];
          const isEscaped = i > 0 && input[i - 1] === "\\";

          if (isEscaped) {
            current += char;
            continue;
          }

          if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            continue;
          }

          if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = "";
            continue;
          }

          if (char === " " && !inQuotes) {
            if (current.trim()) {
              parts.push(current.trim());
              current = "";
            }
            continue;
          }

          current += char;
        }

        if (current.trim()) {
          parts.push(current.trim());
        }

        return {
          cmd: parts[0] || "",
          args: parts.slice(1),
        };
      };

      const { cmd, args } = parseCommand(command);

      // Reset current output line
      currentOutputRef.current = "";
      setCurrentOutputLine("");

      // Use streaming execution for better real-time output
      await executeCommandStream(
        cmd,
        args,
        // onStdout
        (chunk: string) => {
          currentOutputRef.current += chunk;
          // Check if we have a complete line
          if (chunk.includes("\n")) {
            const lines = currentOutputRef.current.split("\n");
            // Add complete lines
            setLines((prevLines) => [
              ...prevLines,
              ...lines
                .slice(0, -1)
                .filter((line) => line.length > 0)
                .map((line) => ({ type: "output" as const, content: line })),
            ]);
            // Keep the last incomplete line
            currentOutputRef.current = lines[lines.length - 1] || "";
            setCurrentOutputLine(currentOutputRef.current);
          } else {
            setCurrentOutputLine(currentOutputRef.current);
          }
        },
        // onStderr
        (chunk: string) => {
          currentOutputRef.current += chunk;
          // Check if we have a complete line
          if (chunk.includes("\n")) {
            const lines = currentOutputRef.current.split("\n");
            // Add complete lines
            setLines((prevLines) => [
              ...prevLines,
              ...lines
                .slice(0, -1)
                .filter((line) => line.length > 0)
                .map((line) => ({ type: "error" as const, content: line })),
            ]);
            // Keep the last incomplete line
            currentOutputRef.current = lines[lines.length - 1] || "";
            setCurrentOutputLine(currentOutputRef.current);
          } else {
            setCurrentOutputLine(currentOutputRef.current);
          }
        },
        // onComplete
        (exitCode: number) => {
          // Add any remaining output
          if (currentOutputRef.current.trim()) {
            setLines((prev) => [
              ...prev,
              {
                type: "output" as const,
                content: currentOutputRef.current,
              },
            ]);
            currentOutputRef.current = "";
            setCurrentOutputLine("");
          }

          // Only show exit code error if there's no stderr
          if (exitCode !== 0) {
            setLines((prev) => [
              ...prev,
              {
                type: "error",
                content: `Command exited with code ${exitCode}`,
              },
            ]);
          }
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setLines((prev) => [
        ...prev,
        {
          type: "error",
          content: `Error: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsExecuting(false);
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal" ref={terminalRef}>
        {lines.map((line, index) => (
          <div
            key={index}
            className={`terminal-line terminal-line-${line.type}`}
          >
            {line.content}
          </div>
        ))}
        {isExecuting && currentOutputLine && (
          <div className="terminal-line terminal-line-output">
            {currentOutputLine}
          </div>
        )}
      </div>
      <div className="terminal-input-container">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-input"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          placeholder="Enter command..."
        />
      </div>
    </div>
  );
}
