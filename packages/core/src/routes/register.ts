import Router from 'koa-router';
import koaBody from 'koa-body';
import { object, string } from 'zod';
import { encryptPassword } from '@/utils/password';
import { hasUser, hasUserWithId, insertUser } from '@/queries/user';
import { customAlphabet, nanoid } from 'nanoid';
import { PasswordEncryptionMethod } from '@logto/schemas';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const userId = customAlphabet(alphabet, 12);

const generateUserId = async (maxRetries = 500) => {
  for (let i = 0; i < maxRetries; ++i) {
    const id = userId();
    // eslint-disable-next-line no-await-in-loop
    if (!(await hasUserWithId(id))) {
      return id;
    }
  }

  throw new Error('Cannot generate user ID in reasonable retries');
};

export default function createRegisterRoutes() {
  const router = new Router();

  router.post('/register', koaBody(), async (ctx) => {
    const RegisterBody = object({
      username: string().min(3),
      password: string().min(6),
    });
    const { username, password } = RegisterBody.parse(ctx.request.body);

    if (await hasUser(username)) {
      throw new Error('Username already exists');
    }

    const id = await generateUserId();
    const passwordEncryptionSalt = nanoid();
    const passwordEncryptionMethod = PasswordEncryptionMethod.SaltAndPepper;
    const passwordEncrypted = encryptPassword(
      id,
      password,
      passwordEncryptionSalt,
      passwordEncryptionMethod
    );

    await insertUser({
      id,
      username,
      passwordEncrypted,
      passwordEncryptionMethod,
      passwordEncryptionSalt,
    });

    ctx.body = { id };
  });

  return router.routes();
}