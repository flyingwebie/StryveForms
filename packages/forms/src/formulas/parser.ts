/**
 * Recursive-descent parser for the computed-variable formula language.
 *
 * Ports `client/lib/formulas/parser.js` (OpnForm, AGPL-3.0). Grammar
 * (lowest to highest precedence):
 *
 *   expression     = comparison
 *   comparison     = addition (("=" | "<>" | "<" | ">" | "<=" | ">=") addition)?
 *   addition       = multiplication (("+" | "-") multiplication)*
 *   multiplication = unary (("*" | "/") unary)*
 *   unary          = ("-" | "NOT") unary | primary
 *   primary        = NUMBER | STRING | BOOLEAN | field_ref | function_call | "(" expression ")"
 */

import { FormulaError, Lexer, type Token, type TokenType } from "./lexer";

export type AstNode =
	| { type: "boolean"; value: boolean }
	| { args: AstNode[]; name: string; type: "function" }
	| { id: string; type: "field" }
	| { left: AstNode; operator: string; right: AstNode; type: "binary" }
	| { operand: AstNode; operator: string; type: "unary" }
	| { type: "number"; value: number }
	| { type: "string"; value: string };

export class Parser {
	private readonly tokens: Token[];
	private current = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	static parse(formula: string): AstNode {
		const tokens = new Lexer(formula).tokenize();
		return new Parser(tokens).parse();
	}

	parse(): AstNode {
		const ast = this.expression();
		if (!this.isAtEnd()) {
			const token = this.peek();
			throw new FormulaError(
				`Unexpected token '${String(token.value)}'`,
				token.position
			);
		}
		return ast;
	}

	private isAtEnd(): boolean {
		return this.peek().type === "EOF";
	}

	private peek(): Token {
		const token = this.tokens[this.current];
		if (!token) {
			throw new FormulaError("Unexpected end of formula");
		}
		return token;
	}

	private previous(): Token {
		const token = this.tokens[this.current - 1];
		if (!token) {
			throw new FormulaError("Unexpected end of formula");
		}
		return token;
	}

	private advance(): Token {
		if (!this.isAtEnd()) {
			this.current += 1;
		}
		return this.previous();
	}

	private check(type: TokenType): boolean {
		return !this.isAtEnd() && this.peek().type === type;
	}

	private consume(type: TokenType, message: string): Token {
		if (this.check(type)) {
			return this.advance();
		}
		throw new FormulaError(message, this.peek().position);
	}

	private matchOperator(type: TokenType, ...values: string[]): boolean {
		if (!this.check(type)) {
			return false;
		}
		const { value } = this.peek();
		if (values.length > 0 && !values.includes(String(value))) {
			return false;
		}
		this.advance();
		return true;
	}

	private expression(): AstNode {
		return this.comparison();
	}

	private comparison(): AstNode {
		const left = this.addition();
		if (this.matchOperator("COMPARISON")) {
			const operator = String(this.previous().value);
			const right = this.addition();
			return { type: "binary", operator, left, right };
		}
		return left;
	}

	private addition(): AstNode {
		let left = this.multiplication();
		while (this.matchOperator("OPERATOR", "+", "-")) {
			const operator = String(this.previous().value);
			const right = this.multiplication();
			left = { type: "binary", operator, left, right };
		}
		return left;
	}

	private multiplication(): AstNode {
		let left = this.unary();
		while (this.matchOperator("OPERATOR", "*", "/")) {
			const operator = String(this.previous().value);
			const right = this.unary();
			left = { type: "binary", operator, left, right };
		}
		return left;
	}

	private unary(): AstNode {
		if (this.matchOperator("OPERATOR", "-")) {
			return { type: "unary", operator: "-", operand: this.unary() };
		}
		if (this.check("IDENTIFIER") && this.peek().value === "NOT") {
			this.advance();
			return { type: "unary", operator: "NOT", operand: this.unary() };
		}
		return this.primary();
	}

	private primary(): AstNode {
		if (this.matchOperator("NUMBER")) {
			return { type: "number", value: Number(this.previous().value) };
		}
		if (this.matchOperator("STRING")) {
			return { type: "string", value: String(this.previous().value) };
		}
		if (this.matchOperator("BOOLEAN")) {
			return { type: "boolean", value: Boolean(this.previous().value) };
		}
		if (this.matchOperator("FIELD_REF")) {
			return { type: "field", id: String(this.previous().value) };
		}
		if (this.matchOperator("IDENTIFIER")) {
			return this.identifierOrFunctionCall();
		}
		if (this.matchOperator("LPAREN")) {
			const expr = this.expression();
			this.consume("RPAREN", "Missing closing parenthesis ')'");
			return expr;
		}
		return this.primaryError();
	}

	private identifierOrFunctionCall(): AstNode {
		const name = String(this.previous().value);
		if (this.check("LPAREN")) {
			return this.functionCall(name);
		}
		throw new FormulaError(
			`Unknown identifier '${name}'. Did you mean to use a field? Use {${name}} or call a function with ${name}()`,
			this.previous().position
		);
	}

	private primaryError(): never {
		const token = this.peek();
		if (token.type === "RPAREN") {
			throw new FormulaError(
				"Unexpected ')'. You may have an extra closing parenthesis or missing content.",
				token.position
			);
		}
		if (token.type === "COMMA") {
			throw new FormulaError(
				"Unexpected ','. Commas should only be used to separate function arguments.",
				token.position
			);
		}
		if (token.type === "EOF") {
			throw new FormulaError(
				"Formula is incomplete. Expected a value or expression.",
				token.position
			);
		}
		throw new FormulaError(
			`Unexpected '${String(token.value)}'. Expected a number, text, field, or function.`,
			token.position
		);
	}

	private functionCall(name: string): AstNode {
		this.consume("LPAREN", `Expected '(' after function name '${name}'`);
		const args: AstNode[] = [];
		if (!this.check("RPAREN")) {
			do {
				args.push(this.expression());
			} while (this.matchOperator("COMMA"));
		}
		this.consume(
			"RPAREN",
			`Missing closing ')' for function ${name.toUpperCase()}()`
		);
		return { type: "function", name, args };
	}
}
