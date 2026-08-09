# Agent Hub

Build the first module of "Billzo Office Management System".

Module Name:

Agent Management + Attendance

Tech:

React + Vite + Tailwind CSS

Supabase Backend

Supabase Auth

Supabase Storage Bucket

PostgreSQL Database

Roles:

1. Super Admin

- Full access

- Manage Admins

- Manage Agents

- View/Edit/Delete all data

- Export reports

- System control

2. Admin

- Manage assigned agents

- Add new agents

- Edit agent information

- Manage attendance

- View reports

3. Agent

- View own profile

- Mark attendance

- Update allowed information

- Upload required documents

====================================

AGENT PROFILE MANAGEMENT

====================================

Create complete agent profile with:

Personal Information

- Profile Picture

- Employee ID (Auto Generate)

- Reference ID (Auto Generate)

- Full Name

- Father Name

- CNIC Number

- CNIC Front Picture Upload

- CNIC Back Picture Upload

- Passport Number

- Passport Picture Upload

- Date of Birth

- Gender

- Blood Group

- Marital Status

Contact Information

- Phone Number

- WhatsApp Number

- Email Address

- Emergency Contact Name

- Emergency Contact Number

- Home Address

- City

- Province

- Country

Employment Information

- Department

- Designation

- Joining Date

- Employee Type

- Shift Timing

- Assigned Admin

- Salary (PKR ₨)

- Status

Status Options:

Active

Inactive

Suspended

Resigned

Education Information

- Highest Qualification

- Institute Name

- Degree

- Certifications

Work Information

- Previous Experience

- Previous Company

- Skills

- Languages

- Notes

Bank Information

- Bank Name

- Account Title

- Account Number

- IBAN

====================================

DOCUMENT STORAGE

====================================

Use Supabase Storage Bucket.

Bucket Name:

agent-documents

Store:

- Profile Pictures

- CNIC Front Images

- CNIC Back Images

- Passport Images

- Certificates

- Resume

- Other Documents

Features:

- Upload Image

- Preview Image

- Replace File

- Delete File

- Secure Access

Database should store:

file_url

file_name

file_type

uploaded_by

uploaded_date

====================================

ATTENDANCE SYSTEM

====================================

Agent Attendance:

Features:

- Clock In

- Clock Out

- Auto Calculate Working Hours

- Attendance History

Attendance Status:

Present

Absent

Late

Half Day

Leave

Holiday

Attendance Data:

- Agent ID

- Date

- Clock In Time

- Clock Out Time

- Total Working Hours

- Status

- Notes

- Created By

====================================

ATTENDANCE DASHBOARD

====================================

Admin Dashboard:

Cards:

- Total Agents

- Present Today

- Absent Today

- Late Today

- On Leave

Table:

Agent Name

Employee ID

Department

Clock In

Clock Out

Working Hours

Status

Filters:

- Date

- Department

- Agent

- Status

Export:

PDF

Excel

CSV

====================================

DATABASE TABLES

====================================

users

profiles

agents

agent_documents

attendance

departments

designations

activity_logs

====================================

UI DESIGN

====================================

Premium SaaS Style

- Dark Glass Theme

- Modern Dashboard

- Animated Cards

- Smooth Transitions

- Responsive Design

- Advanced Search

- Data Tables

- Filters

- Image Preview Modal

- Drag & Drop Upload

Make this module production ready and scalable for future Billzo features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/163a0b79-4e5f-4b4c-b3d5-9b461baef64e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
