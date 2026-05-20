
import os

def find_mismatch(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for line_num, line in enumerate(lines, 1):
        for char_num, char in enumerate(line, 1):
            if char == '(':
                stack.append((line_num, char_num))
            elif char == ')':
                if stack:
                    stack.pop()
                else:
                    print(f"Extra closing parenthesis at Line {line_num}, Char {char_num}")
    
    if stack:
        print("Unclosed opening parentheses:")
        for ln, cn in stack:
            print(f"Line {ln}, Char {cn}")

if __name__ == "__main__":
    find_mismatch(r'C:\Users\patio\mundo-rosa\src\components\AdminPanel.jsx')
