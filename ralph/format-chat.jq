#!/usr/bin/env -S jq -r -f
# Based on https://tarq.net/posts/cursor-agent-stream-format/
# Adapted for --stream-partial-output (character-level text deltas).

# Helper function to truncate long strings
def truncate_string(str; max_length):
  if str | length > max_length then
    str[0:max_length] + "..."
  else
    str
  end;

# Helper function to format arguments with truncation
def format_args(args):
  if args == null then
    ""
  else
    " " + (args | to_entries | map(
      if .value | type == "string" then
        "\(.key): \"\(.value | truncate_string(50))\""
      elif .value | type == "array" then
        "\(.key): [\(.value | length) items]"
      elif .value | type == "object" then
        "\(.key): {\(.value | keys | length) fields}"
      else
        "\(.key): \(.value)"
      end
    ) | join(", "))
  end;

if .type == "user" then
  empty
elif .type == "assistant" then
  if .model_call_id != null then empty
  elif .timestamp_ms != null then
    (.message.content[]? | select(.type == "text").text // empty)
  else empty end
elif .type == "tool_call" and .subtype == "started" then
  if .tool_call.shellToolCall then
    "\n\u001b[33m[SHELL]\u001b[0m \(.tool_call.shellToolCall.args.command)"
  elif .tool_call.readToolCall then
    "\n\u001b[33m[READ]\u001b[0m \(.tool_call.readToolCall.args.path)\(if .tool_call.readToolCall.args.offset then " (offset: \(.tool_call.readToolCall.args.offset), limit: \(.tool_call.readToolCall.args.limit))" else "" end)"
  elif .tool_call.editToolCall then
    "\n\u001b[33m[EDIT]\u001b[0m \(.tool_call.editToolCall.args.path)"
  elif .tool_call.grepToolCall then
    "\n\u001b[33m[GREP]\u001b[0m \(.tool_call.grepToolCall.args.pattern) in \(.tool_call.grepToolCall.args.path)"
  elif .tool_call.lsToolCall then
    "\n\u001b[33m[LS]\u001b[0m \(.tool_call.lsToolCall.args.path)\(if .tool_call.lsToolCall.args.ignore and (.tool_call.lsToolCall.args.ignore | length) > 0 then " (ignore: \(.tool_call.lsToolCall.args.ignore | join(", ")))" else "" end)"
  elif .tool_call.globToolCall then
    "\n\u001b[33m[GLOB]\u001b[0m \(.tool_call.globToolCall.args.globPattern) in \(.tool_call.globToolCall.args.targetDirectory)"
  elif .tool_call.todoToolCall then
    "\n\u001b[33m[TODO]\u001b[0m \(.tool_call.todoToolCall.args.merge // false | if . then "merge" else "create" end) \(.tool_call.todoToolCall.args.todos | length) todos" +
    (if .tool_call.todoToolCall.args.todos and (.tool_call.todoToolCall.args.todos | length) > 0 then
      "\n  " + (.tool_call.todoToolCall.args.todos | map(
        (.status // "unknown" | if . == "TODO_STATUS_PENDING" then "⏳" elif . == "TODO_STATUS_IN_PROGRESS" then "🔄" elif . == "TODO_STATUS_COMPLETED" then "✅" elif . == "TODO_STATUS_CANCELLED" then "❌" else "❓" end) + " " + .content
      ) | join("\n  "))
    else "" end)
  elif .tool_call.updateTodosToolCall then
    "\n\u001b[33m[UPDATE_TODOS]\u001b[0m \(.tool_call.updateTodosToolCall.args.merge // false | if . then "merge" else "create" end) \(.tool_call.updateTodosToolCall.args.todos | length) todos" +
    (if .tool_call.updateTodosToolCall.args.todos and (.tool_call.updateTodosToolCall.args.todos | length) > 0 then
      "\n  " + (.tool_call.updateTodosToolCall.args.todos | map(
        (.status // "unknown" | if . == "TODO_STATUS_PENDING" then "⏳" elif . == "TODO_STATUS_IN_PROGRESS" then "🔄" elif . == "TODO_STATUS_COMPLETED" then "✅" elif . == "TODO_STATUS_CANCELLED" then "❌" else "❓" end) + " " + .content
      ) | join("\n  "))
    else "" end)
  elif .tool_call.writeToolCall then
    "\n\u001b[33m[WRITE]\u001b[0m \(.tool_call.writeToolCall.args.path) (\(.tool_call.writeToolCall.args.fileText | length) chars)\n  " + (.tool_call.writeToolCall.args.fileText | if length > 100 then .[0:100] + "..." else . end)
  elif .tool_call.deleteToolCall then
    "\n\u001b[33m[DELETE]\u001b[0m \(.tool_call.deleteToolCall.args.path)"
  else
    "\n\u001b[33m[TOOL]\u001b[0m \(.tool_call | keys[0])" +
    (if .tool_call | to_entries[0].value.args then
      " " + (.tool_call | to_entries[0].value.args | to_entries | map(
        if .value | type == "string" then
          "\(.key): \"\(.value | if length > 50 then .[0:50] + "..." else . end)\""
        elif .value | type == "array" then
          "\(.key): [\(.value | length) items]"
        elif .value | type == "object" then
          "\(.key): {\(.value | keys | length) fields}"
        else
          "\(.key): \(.value)"
        end
      ) | join(", "))
    else "" end)
  end
elif .type == "tool_call" and .subtype == "completed" then
  if .tool_call.shellToolCall then
    if .tool_call.shellToolCall.result.success then
      "\n\u001b[90m✓ Exit \(.tool_call.shellToolCall.result.success.exitCode)\u001b[0m"
    else
      "\n\u001b[91m✗ Failed\u001b[0m"
    end
  elif .tool_call.readToolCall then
    if .tool_call.readToolCall.result.success then
      "\n\u001b[90m✓ Read \(.tool_call.readToolCall.result.success.totalLines) lines\u001b[0m"
    else
      "\n\u001b[91m✗ Read failed\u001b[0m"
    end
  elif .tool_call.editToolCall then
    if .tool_call.editToolCall.result.success then
      "\n\u001b[90m✓ Edited\u001b[0m"
    else
      "\n\u001b[91m✗ Edit failed\u001b[0m"
    end
  elif .tool_call.grepToolCall then
    if .tool_call.grepToolCall.result.success then
      "\n\u001b[90m✓ Found \(.tool_call.grepToolCall.result.success.workspaceResults | to_entries[0].value.content.totalMatchedLines) matches\u001b[0m"
    else
      "\n\u001b[91m✗ Grep failed\u001b[0m"
    end
  elif .tool_call.lsToolCall then
    if .tool_call.lsToolCall.result.success then
      "\n\u001b[90m✓ Listed \(.tool_call.lsToolCall.result.success.directoryTreeRoot.childrenFiles | length) files, \(.tool_call.lsToolCall.result.success.directoryTreeRoot.childrenDirs | length) dirs\u001b[0m"
    else
      "\n\u001b[91m✗ List failed\u001b[0m"
    end
  elif .tool_call.globToolCall then
    if .tool_call.globToolCall.result.success then
      "\n\u001b[90m✓ Found \(.tool_call.globToolCall.result.success.totalFiles) files\u001b[0m"
    else
      "\n\u001b[91m✗ Glob failed\u001b[0m"
    end
  elif .tool_call.todoToolCall then
    if .tool_call.todoToolCall.result.success then
      "\n\u001b[90m✓ Updated todos\u001b[0m" +
      (if .tool_call.todoToolCall.result.success.todos and (.tool_call.todoToolCall.result.success.todos | length) > 0 then
        "\n  " + (.tool_call.todoToolCall.result.success.todos | map(
          (.status // "unknown" | if . == "TODO_STATUS_PENDING" then "⏳" elif . == "TODO_STATUS_IN_PROGRESS" then "🔄" elif . == "TODO_STATUS_COMPLETED" then "✅" elif . == "TODO_STATUS_CANCELLED" then "❌" else "❓" end) + " " + .content
        ) | join("\n  "))
      else "" end)
    else
      "\n\u001b[91m✗ Todo update failed\u001b[0m"
    end
  elif .tool_call.updateTodosToolCall then
    if .tool_call.updateTodosToolCall.result.success then
      "\n\u001b[90m✓ Updated todos\u001b[0m" +
      (if .tool_call.updateTodosToolCall.result.success.todos and (.tool_call.updateTodosToolCall.result.success.todos | length) > 0 then
        "\n  " + (.tool_call.updateTodosToolCall.result.success.todos | map(
          (.status // "unknown" | if . == "TODO_STATUS_PENDING" then "⏳" elif . == "TODO_STATUS_IN_PROGRESS" then "🔄" elif . == "TODO_STATUS_COMPLETED" then "✅" elif . == "TODO_STATUS_CANCELLED" then "❌" else "❓" end) + " " + .content
        ) | join("\n  "))
      else "" end)
    else
      "\n\u001b[91m✗ Todo update failed\u001b[0m"
    end
  elif .tool_call.writeToolCall then
    if .tool_call.writeToolCall.result.success then
      "\n\u001b[90m✓ Wrote \(.tool_call.writeToolCall.result.success.linesCreated) lines (\(.tool_call.writeToolCall.result.success.fileSize) bytes) to \(.tool_call.writeToolCall.args.path)\u001b[0m"
    else
      "\n\u001b[91m✗ Write failed\u001b[0m"
    end
  elif .tool_call.deleteToolCall then
    if .tool_call.deleteToolCall.result.success then
      "\n\u001b[90m✓ Deleted \(.tool_call.deleteToolCall.args.path)\u001b[0m"
    elif .tool_call.deleteToolCall.result.rejected then
      "\n\u001b[91m✗ Delete rejected: \(.tool_call.deleteToolCall.result.rejected.reason // "unknown reason")\u001b[0m"
    else
      "\n\u001b[91m✗ Delete failed\u001b[0m"
    end
  else
    "\n\u001b[90m✓ Completed\u001b[0m"
  end
elif .type == "result" then
  "\n\u001b[35m[RESULT]\u001b[0m \(.subtype) (\(.duration_ms)ms)"
else
  empty
end
