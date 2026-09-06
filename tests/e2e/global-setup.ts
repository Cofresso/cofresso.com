import setupDatabase from '../integration/global-setup';

export default async function globalSetup() {
  await setupDatabase();
}
