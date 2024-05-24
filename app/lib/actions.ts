'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

// Define a schema for form validation using Zod
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer'
    }),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select invoice status'
    }),
    date: z.string(),
});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

/**
 * Creates a new invoice.
 *
 * @param {State} prevState - The previous state, including any validation errors or messages.
 * @param {FormData} formData - The form data submitted by the user.
 * @returns {Promise<State | void>} - Returns an object containing a message in case of error, otherwise redirects to the invoices dashboard.
 */
export async function createInvoice(prevState: State, formData: FormData): Promise<State | void> {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.format(),
            message: 'Validation failed'
        };
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: failed to create invoice'
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');

    const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    };
    console.log(rawFormData);
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

/**
 * Updates an existing invoice.
 *
 * @param {string} id - The ID of the invoice to update.
 * @param {State} prevState - The previous state, including any validation errors or messages.
 * @param {FormData} formData - The form data submitted by the user.
 * @returns {Promise<State | void>} - Returns an object containing a message in case of error, otherwise redirects to the invoices dashboard.
 */
export async function updateInvoice(id: string, prevState: State, formData: FormData): Promise<State | void> {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.format(),
            message: 'Validation failed'
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch (error) {
        return { message: 'Database error: failed to update invoice' };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

/**
 * Deletes an existing invoice.
 *
 * @param {string} id - The ID of the invoice to delete.
 * @returns {Promise<State | void>} - Returns an object containing a message in case of error, otherwise revalidates the invoices path.
 */
export async function deleteInvoice(id: string): Promise<State | void> {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
    } catch (error) {
        return { message: 'Database error: failed to delete invoice' };
    }
}
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}