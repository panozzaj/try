import React from "react";
import { Box, Text, useInput } from "ink";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  useInput((input, key) => {
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input && !key.return) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text color="cyan">{"> "}</Text>
      {value ? (
        <Text>{value}</Text>
      ) : (
        <Text color="gray">{placeholder}</Text>
      )}
      <Text color="cyan">█</Text>
    </Box>
  );
}
