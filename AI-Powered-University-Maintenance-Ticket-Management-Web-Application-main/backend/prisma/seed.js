const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dbJsonPath = path.join(__dirname, '..', 'data', 'db.json');
  const fileData = fs.readFileSync(dbJsonPath, 'utf-8');
  const data = JSON.parse(fileData);

  console.log('Seeding IssueTypes...');
  for (const issueType of data.issueTypes) {
    await prisma.issueType.upsert({
      where: { id: issueType.id },
      update: {},
      create: {
        id: issueType.id,
        name: issueType.name,
        description: issueType.description,
        icon: issueType.icon,
      },
    });
  }

  console.log('Seeding Tickets...');
  for (const ticket of data.tickets) {
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {},
      create: {
        id: ticket.id,
        ticket_no: ticket.ticket_no,
        title: ticket.title,
        description: ticket.description,
        issue_type: ticket.issue_type,
        location: ticket.location,
        priority: ticket.priority,
        status: ticket.status,
        requester_name: ticket.requester_name,
        requester_email: ticket.requester_email,
        assigned_to: ticket.assigned_to || null,
        resolution_note: ticket.resolution_note || null,
        created_at: new Date(ticket.created_at),
        updated_at: new Date(ticket.updated_at),
        closed_at: ticket.closed_at ? new Date(ticket.closed_at) : null,
      },
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
