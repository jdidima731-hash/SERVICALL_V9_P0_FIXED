import postgres from 'postgres';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required in environment variables.');
}

const sql = postgres(DATABASE_URL);

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('[seedAdmin] ADMIN_EMAIL and ADMIN_PASSWORD are required in environment variables.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    // Vérifier si l'admin existe déjà
    const existingAdmin = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingAdmin.length > 0) {
      console.log('Admin account already exists. Skipping creation.');
      return;
    }

    // Création de l'admin
    const [user] = await sql`
      INSERT INTO users (
        open_id, 
        email, 
        password_hash, 
        role, 
        name, 
        is_active, 
        login_method,
        created_at,
        updated_at
      ) VALUES (
        ${nanoid()}, 
        ${email}, 
        ${hashedPassword}, 
        'owner', 
        'Admin Servicall', 
        true, 
        'local',
        NOW(),
        NOW()
      ) RETURNING *
    `;
    
    console.log('Admin account created successfully:', user);

    // Création d'un tenant par défaut pour cet admin
    const [tenant] = await sql`
      INSERT INTO tenants (
        slug, 
        name, 
        is_active,
        created_at,
        updated_at
      ) VALUES (
        ${`tenant-${user.id}`}, 
        ${`Espace ${user.name}`}, 
        true,
        NOW(),
        NOW()
      ) RETURNING *
    `;

    // Lier l'admin au tenant
    await sql`
      INSERT INTO tenant_users (
        user_id, 
        tenant_id, 
        role,
        created_at,
        updated_at
      ) VALUES (
        ${user.id}, 
        ${tenant.id}, 
        'owner',
        NOW(),
        NOW()
      )
    `;

    console.log('Default tenant and user-tenant link created successfully.');
  } catch (error: any) {
    console.error('Error seeding admin account and default tenant:', error);
    throw error;
  }
}

// Exécution si appelé directement
seedAdmin()
  .then(() => {
    console.log('Seed completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
