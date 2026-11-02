-- Só para o MySQL local de desenvolvimento: o `prisma migrate dev` precisa criar um "shadow database".
GRANT ALL PRIVILEGES ON *.* TO 'compasso'@'%';
FLUSH PRIVILEGES;
