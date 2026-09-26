import ast
import operator
from typing import Dict, Any

# Safe operators map
OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

def evaluate_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"Unsupported constant type: {type(node.value)}")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Operator {op_type.__name__} is not allowed")
        left = evaluate_node(node.left)
        right = evaluate_node(node.right)
        if op_type is ast.Div and right == 0:
            raise ZeroDivisionError("Division by zero")
        if op_type is ast.Mod and right == 0:
            raise ZeroDivisionError("Modulo by zero")
        return OPERATORS[op_type](left, right)
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Unary operator {op_type.__name__} is not allowed")
        operand = evaluate_node(node.operand)
        return OPERATORS[op_type](operand)
    else:
        raise ValueError(f"Disallowed expression element: {type(node).__name__}")

def calculator(expression: str) -> Dict[str, Any]:
    """Safe arithmetic evaluator using AST parsing without unrestricted eval()."""
    sanitized = expression.strip().replace('^', '**')
    if not sanitized:
        raise ValueError("Expression is empty")
    
    parsed = ast.parse(sanitized, mode='eval')
    result = evaluate_node(parsed.body)
    
    # Clean floating rounding
    rounded = round(result, 6) if abs(result - round(result, 6)) < 1e-9 else result
    return {
        "expression": expression,
        "result": rounded
    }
