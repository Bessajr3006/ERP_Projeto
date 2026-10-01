import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Employee, CreateEmployeeData, UpdateEmployeeData } from '../types/Employee';

export class EmployeeService {
    static async create(companyId: number, data: CreateEmployeeData): Promise<Employee> {
        const publicId = randomUUID();
        const {
            name, cpf, rg, birth_date, admission_date, resignation_date,
            salary = 0, position, phone, email, address, city, state, zip_code, status = 'active'
        } = data;

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO employees (
                public_id, company_id, name, cpf, rg, birth_date, admission_date, resignation_date,
                salary, position, phone, email, address, city, state, zip_code, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId, companyId, name.trim(), cpf || null, rg || null,
                birth_date || null, admission_date || null, resignation_date || null,
                salary, position || null, phone || null, email || null,
                address || null, city || null, state || null, zip_code || null, status
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create employee');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<Employee> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Employee not found');
        }

        return rows[0] as Employee;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<Employee> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM employees WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Employee not found');
        }

        return rows[0] as Employee;
    }

    static async listByCompany(companyId: number): Promise<Employee[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM employees WHERE company_id = ? ORDER BY name ASC`,
            [companyId]
        );

        return rows as Employee[];
    }

    static async update(publicId: string, companyId: number, data: UpdateEmployeeData): Promise<Employee> {
        const employee = await this.getByPublicId(publicId, companyId);

        const updateFields: string[] = [];
        const values: any[] = [];

        const allowedFields: (keyof UpdateEmployeeData)[] = [
            'name', 'cpf', 'rg', 'birth_date', 'admission_date', 'resignation_date',
            'salary', 'position', 'phone', 'email', 'address', 'city', 'state', 'zip_code', 'status'
        ];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                let val = data[field];
                if (typeof val === 'string' && field === 'name') {
                    val = val.trim();
                }
                values.push(val === '' ? null : val);
            }
        }

        if (updateFields.length === 0) {
            return employee;
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE employees SET ${updateFields.join(', ')} WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Employee not found');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM employees WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        if (result.affectedRows === 0) {
            throw new Error('Employee not found');
        }
    }
}
