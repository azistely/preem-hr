/**
 * Button Component Browser Tests
 *
 * Run with: npm test -- --browser
 * Run specific test: npm test button.test.tsx -- --browser
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, describe } from 'vitest';
import { Button } from '../button';

describe('Button Component', () => {
  test('renders button with text', async () => {
    render(<Button>Cliquer ici</Button>);

    const button = screen.getByRole('button', { name: /cliquer ici/i });
    expect(button).toBeInTheDocument();
  });

  test('handles click events', async () => {
    let clicked = false;
    const handleClick = () => { clicked = true; };

    render(<Button onClick={handleClick}>Cliquer</Button>);

    const button = screen.getByRole('button', { name: /cliquer/i });
    await userEvent.click(button);

    expect(clicked).toBe(true);
  });

  test('renders different variants correctly', async () => {
    const { container: defaultContainer } = render(<Button variant="default">Default</Button>);
    const { container: destructiveContainer } = render(<Button variant="destructive">Destructive</Button>);
    const { container: outlineContainer } = render(<Button variant="outline">Outline</Button>);

    const defaultButton = screen.getByRole('button', { name: /^default$/i });
    const destructiveButton = screen.getByRole('button', { name: /destructive/i });
    const outlineButton = screen.getByRole('button', { name: /outline/i });

    expect(defaultButton).toHaveClass('bg-primary');
    expect(destructiveButton).toHaveClass('bg-destructive');
    expect(outlineButton).toHaveClass('border');
  });

  test('renders different sizes correctly', async () => {
    render(
      <>
        <Button size="sm">Petit</Button>
        <Button size="default">Normal</Button>
        <Button size="lg">Grand</Button>
      </>
    );

    const smallButton = screen.getByRole('button', { name: /petit/i });
    const defaultButton = screen.getByRole('button', { name: /normal/i });
    const largeButton = screen.getByRole('button', { name: /grand/i });

    expect(smallButton).toHaveClass('h-9');
    expect(defaultButton).toHaveClass('h-10');
    expect(largeButton).toHaveClass('h-11');
  });

  test('can be disabled', async () => {
    const handleClick = vi.fn();

    render(<Button disabled onClick={handleClick}>Désactivé</Button>);

    const button = screen.getByRole('button', { name: /désactivé/i });

    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none');

    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders as child component when asChild is true', async () => {
    render(
      <Button asChild>
        <a href="/test">Lien</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /lien/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  test('applies custom className', async () => {
    render(<Button className="custom-class">Personnalisé</Button>);

    const button = screen.getByRole('button', { name: /personnalisé/i });
    expect(button).toHaveClass('custom-class');
  });
});
