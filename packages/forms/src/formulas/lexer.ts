/**
 * Lexer for the computed-variable formula language.
 *
 * Ports `client/lib/formulas/lexer.js` (OpnForm, AGPL-3.0) token-for-token so
 * imported forms evaluate identically. Grammar/semantics are documented in
 * specs/A-fields-logic-validation.md section 5.
 */

export type TokenType =
	| "BOOLEAN"
	| "COMMA"
	| "COMPARISON"
	| "EOF"
	| "FIELD_REF"
	| "IDENTIFIER"
	| "LPAREN"
	| "NUMBER"
	| "OPERATOR"
	| "RPAREN"
	| "STRING";

export interface Token {
	position: number;
	type: TokenType;
	value: boolean | number | string | null;
}

export class FormulaError extends Error {
	position: number | null;

	constructor(message: string, position: number | null = null) {
		super(message);
		this.name = "FormulaError";
		this.position = position;
	}
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

function isAlpha(char: string | undefined): boolean {
	return (
		char !== undefined &&
		((char >= "a" && char <= "z") ||
			(char >= "A" && char <= "Z") ||
			char === "_")
	);
}

function isAlphaNumeric(char: string | undefined): boolean {
	return isAlpha(char) || isDigit(char);
}

function isWhitespace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}

/** Converts a formula string into a stream of tokens. */
export class Lexer {
	private readonly input: string;
	private position = 0;

	constructor(input: string) {
		this.input = input;
	}

	private isAtEnd(): boolean {
		return this.position >= this.input.length;
	}

	private peek(): string | undefined {
		return this.input[this.position];
	}

	private peekNext(): string | undefined {
		return this.input[this.position + 1];
	}

	private advance(): string {
		const char = this.input[this.position];
		this.position += 1;
		// biome-ignore lint/style/noNonNullAssertion: bounds are checked by every caller via isAtEnd()
		return char!;
	}

	private skipWhitespace(): void {
		while (!this.isAtEnd() && isWhitespace(this.peek())) {
			this.advance();
		}
	}

	private readNumber(): Token {
		const start = this.position;
		while (!this.isAtEnd() && isDigit(this.peek())) {
			this.advance();
		}
		if (!this.isAtEnd() && this.peek() === "." && isDigit(this.peekNext())) {
			this.advance();
			while (!this.isAtEnd() && isDigit(this.peek())) {
				this.advance();
			}
		}
		const value = Number.parseFloat(this.input.slice(start, this.position));
		return { type: "NUMBER", value, position: start };
	}

	private readString(quote: string): Token {
		const start = this.position;
		this.advance();
		let value = "";
		while (!this.isAtEnd() && this.peek() !== quote) {
			if (this.peek() === "\\" && this.peekNext() === quote) {
				this.advance();
			}
			value += this.advance();
		}
		if (this.isAtEnd()) {
			throw new FormulaError(
				`Unterminated string starting at position ${start}`,
				start
			);
		}
		this.advance();
		return { type: "STRING", value, position: start };
	}

	private readIdentifier(): Token {
		const start = this.position;
		while (!this.isAtEnd() && isAlphaNumeric(this.peek())) {
			this.advance();
		}
		const value = this.input.slice(start, this.position);
		const upper = value.toUpperCase();
		if (upper === "TRUE") {
			return { type: "BOOLEAN", value: true, position: start };
		}
		if (upper === "FALSE") {
			return { type: "BOOLEAN", value: false, position: start };
		}
		return { type: "IDENTIFIER", value: upper, position: start };
	}

	private readFieldRef(): Token {
		const start = this.position;
		this.advance();
		let fieldId = "";
		while (!this.isAtEnd() && this.peek() !== "}") {
			fieldId += this.advance();
		}
		if (this.isAtEnd()) {
			throw new FormulaError(
				`Unterminated field reference starting at position ${start}`,
				start
			);
		}
		this.advance();
		return { type: "FIELD_REF", value: fieldId.trim(), position: start };
	}

	private readTwoCharOperator(): Token | null {
		const char = this.peek();
		const next = this.peekNext();
		const start = this.position;
		const twoChar = `${char}${next}`;
		if (char === "<" && (next === ">" || next === "=")) {
			this.advance();
			this.advance();
			return { type: "COMPARISON", value: twoChar, position: start };
		}
		if (char === ">" && next === "=") {
			this.advance();
			this.advance();
			return { type: "COMPARISON", value: twoChar, position: start };
		}
		return null;
	}

	private readSingleCharToken(): Token {
		const char = this.peek();
		const start = this.position;
		switch (char) {
			case "(":
				this.advance();
				return { type: "LPAREN", value: "(", position: start };
			case ")":
				this.advance();
				return { type: "RPAREN", value: ")", position: start };
			case ",":
				this.advance();
				return { type: "COMMA", value: ",", position: start };
			case "+":
			case "-":
			case "*":
			case "/":
				this.advance();
				return { type: "OPERATOR", value: char, position: start };
			case "=":
			case "<":
			case ">":
				this.advance();
				return { type: "COMPARISON", value: char, position: start };
			default:
				throw new FormulaError(
					`Unexpected character '${char}' at position ${start}`,
					start
				);
		}
	}

	tokenize(): Token[] {
		const tokens: Token[] = [];
		this.position = 0;

		while (!this.isAtEnd()) {
			this.skipWhitespace();
			if (this.isAtEnd()) {
				break;
			}

			const char = this.peek();
			if (isDigit(char)) {
				tokens.push(this.readNumber());
				continue;
			}
			if (char === '"' || char === "'") {
				tokens.push(this.readString(char));
				continue;
			}
			if (isAlpha(char)) {
				tokens.push(this.readIdentifier());
				continue;
			}
			if (char === "{") {
				tokens.push(this.readFieldRef());
				continue;
			}

			const twoChar = this.readTwoCharOperator();
			tokens.push(twoChar ?? this.readSingleCharToken());
		}

		tokens.push({ type: "EOF", value: null, position: this.position });
		return tokens;
	}
}

export function tokenize(input: string): Token[] {
	return new Lexer(input).tokenize();
}
