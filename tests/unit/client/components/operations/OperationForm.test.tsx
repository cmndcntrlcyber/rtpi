import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationForm from '../../../../../client/src/components/operations/OperationForm';

vi.mock('@/hooks/useWorkflowTemplates', () => ({
  useWorkflowTemplates: () => ({
    templates: [],
    loading: false,
    reorder: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/markdown/MarkdownEditor', () => ({
  default: ({ value, onChange }: any) => (
    <textarea data-testid="markdown-editor" value={value || ''} onChange={(e: any) => onChange?.(e.target.value)} />
  ),
}));

vi.mock('@/components/shared/DynamicFieldList', () => ({
  default: () => <div data-testid="dynamic-field-list" />,
}));

vi.mock('@/components/shared/QuestionResponseTable', () => ({
  default: () => <div data-testid="question-response-table" />,
  __esModule: true,
}));

vi.mock('@/components/operations/LinkedTargets', () => ({
  default: () => <div data-testid="linked-targets" />,
}));

vi.mock('@/components/operations/CompletedWorkflows', () => ({
  default: () => <div data-testid="completed-workflows" />,
}));

vi.mock('@/components/operations/BugBountyImportCard', () => ({
  default: () => <div data-testid="bug-bounty-import" />,
}));

describe('OperationForm Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering in Create Mode', () => {
    it('should render form dialog when open', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      expect(screen.getByText('Create New Operation')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<OperationForm open={false} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      expect(screen.queryByText('Create New Operation')).not.toBeInTheDocument();
    });

    it('should render key form fields', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      expect(screen.getByLabelText(/Operation Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Purpose/i)).toBeInTheDocument();
      expect(screen.getByText(/Status \*/i)).toBeInTheDocument();
    });

    it('should render create button', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      expect(screen.getByRole('button', { name: /Create Operation/i })).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
  });

  describe('Rendering in Edit Mode', () => {
    it('should display edit mode title', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} mode="edit" />);
      expect(screen.getByText('Edit Operation')).toBeInTheDocument();
    });

    it('should display save button in edit mode', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} mode="edit" />);
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should allow name input', async () => {
      const user = userEvent.setup();
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);

      const nameInput = screen.getByLabelText(/Operation Name/i);
      await user.type(nameInput, 'Test Operation');

      expect((nameInput as HTMLInputElement).value).toBe('Test Operation');
    });

    it('should allow purpose input', async () => {
      const user = userEvent.setup();
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);

      const purposeInput = screen.getByLabelText(/Purpose/i);
      await user.type(purposeInput, 'Test description');

      expect((purposeInput as HTMLTextAreaElement).value).toBe('Test description');
    });

    it('should submit form with data', async () => {
      const user = userEvent.setup();
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);

      const nameInput = screen.getByLabelText(/Operation Name/i);
      await user.type(nameInput, 'New Operation');

      const submitButton = screen.getByRole('button', { name: /Create Operation/i });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Operation'
      }));
    });

    it('should close dialog on cancel', async () => {
      const user = userEvent.setup();
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Initial Data', () => {
    const initialData = {
      name: 'Existing Operation',
      description: 'Existing description',
      status: 'active',
    };

    it('should populate form with initial data', () => {
      render(
        <OperationForm
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          initialData={initialData}
        />
      );

      const nameInput = screen.getByLabelText(/Operation Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Existing Operation');
    });

    it('should show initial purpose', () => {
      render(
        <OperationForm
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          initialData={initialData}
        />
      );

      const purposeInput = screen.getByLabelText(/Purpose/i) as HTMLTextAreaElement;
      expect(purposeInput.value).toBe('Existing description');
    });
  });

  describe('Validation', () => {
    it('should mark name field as required', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      const nameInput = screen.getByLabelText(/Operation Name/i);
      expect(nameInput).toBeRequired();
    });

    it('should have default status value', () => {
      render(<OperationForm open={true} onOpenChange={mockOnOpenChange} onSubmit={mockOnSubmit} />);
      const statusLabel = screen.getByText(/Status \*/i);
      expect(statusLabel).toBeInTheDocument();
    });
  });
});
