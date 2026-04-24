
DO $$
DECLARE
  viewer uuid := '4ab5bf0d-b67e-4262-bfc5-04da4f79bc5a';
  creator_uid uuid;
  post_id uuid;
  thread_id uuid;
  msg_id uuid;
  ua uuid; ub uuid;
  i int;
  names text[] := ARRAY[
    'Aline Souza','Bruna Lima','Carla Mendes','Duda Rocha','Elisa Vieira',
    'Fernanda Reis','Gabi Castro','Helena Cruz','Isadora Pires','Jade Oliveira',
    'Karol Antunes','Lara Britto','Manu Ferreira','Nina Tavares','Olívia Pacheco',
    'Paloma Cardoso','Quezia Moraes','Rafa Andrade','Sabrina Luz','Tati Nogueira',
    'Ursula Bastos','Vivi Coelho','Wanda Prado','Xena Cordeiro','Yasmin Barros',
    'Zoe Marques','Amanda Faria','Bia Marin','Camila Sales','Daiana Pinto',
    'Eduarda Cunha','Flávia Mota','Geovana Pires','Helô Damasco','Ingrid Ribas',
    'Júlia Vargas','Kelly Soares','Letícia Alves','Mariana Dias','Naomi Brandt',
    'Otávia Bezerra','Patrícia Lopes','Quesia Sales','Renata Costa','Sofia Aragão',
    'Thaís Macedo','Ully Vianna','Vitória Sá','Wesley Star','Yara Monteiro'
  ];
  unames text[] := ARRAY[
    'aline','bruna','carla','duda','elisa','fernanda','gabi','helena','isadora','jade',
    'karol','lara','manu','nina','olivia','paloma','quezia','rafa','sabrina','tati',
    'ursula','vivi','wanda','xena','yasmin','zoe','amanda','bia','camila','daiana',
    'eduarda','flavia','geovana','helo','ingrid','julia','kelly','leticia','mariana','naomi',
    'otavia','patricia','quesia','renata','sofia','thais','ully','vitoria','wesley','yara'
  ];
  bios_arr text[] := ARRAY[
    'Conteúdo exclusivo todos os dias 💋 PPV no chat',
    'Brasileira, fitness e safada. Vem ver tudo 🔥',
    'Tu tá pronto pra mim? 😈 Conteúdo +18 sem censura',
    'Loirinha gostosa, novidades toda semana 💖',
    'Cosplay, ensaios e muito mais. Assina e curte tudo!',
    'Morena de olhos verdes 🌿 Mensagem privada respondida sempre',
    'Ruiva safadinha — vídeos longos exclusivos 🎬',
    'Universitária 21 anos, fetiches diversos 🖤',
    'Casada, conteúdo casal exclusivo 😏',
    'Ensaios sensuais e lives semanais 🔴'
  ];
  covers text[] := ARRAY[
    'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=1200&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80',
    'https://images.unsplash.com/photo-1521577352947-9bb58764b69a?w=1200&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=80',
    'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1200&q=80'
  ];
  post_imgs text[] := ARRAY[
    'https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=900&q=80',
    'https://images.unsplash.com/photo-1517677129300-07b130802f46?w=900&q=80',
    'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=900&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80',
    'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=900&q=80',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=900&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=900&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&q=80',
    'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=900&q=80',
    'https://images.unsplash.com/photo-1581824283135-0666cf353f35?w=900&q=80',
    'https://images.unsplash.com/photo-1492288991661-058aa541ff43?w=900&q=80',
    'https://images.unsplash.com/photo-1485875437342-9b39470b3d95?w=900&q=80'
  ];
  bodies text[] := ARRAY[
    'Bom diaaa amores ☀️ acordei com saudade de vocês',
    'Conteúdo novo no perfil 💦 corre lá!',
    'Vocês preferem lingerie preta ou vermelha?? 🖤❤️',
    'PPV exclusivo liberado — só pra quem desbloquear 🔓',
    'Live hoje às 22h, vai ter surpresa 😈',
    'Quem quer ver o ensaio completo? Manda mensagem 💌',
    'Vídeo de 12 min novo no chat — cheguem 🔥',
    'Treinei e tô toda suada… alguém pra ajudar no banho? 🚿',
    'Bom dia com café e sem roupa 😏☕',
    'Meta da semana: contribua e libere o vídeo top 💸'
  ];
  pic_idx int;
  cover_idx int;
  bio_idx int;
  body_idx int;
  visib text;
  goal_target int;
  goal_raised int;
  has_goal boolean;
  has_thread boolean;
  has_sub boolean;
  total_per_post int;
BEGIN
  FOR i IN 1..50 LOOP
    creator_uid := gen_random_uuid();
    cover_idx := ((i - 1) % array_length(covers, 1)) + 1;
    bio_idx := ((i - 1) % array_length(bios_arr, 1)) + 1;

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      creator_uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      unames[i] || '+demo@venyx.local',
      crypt('demo-password-' || unames[i], gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"demo","providers":["demo"]}'::jsonb,
      jsonb_build_object('username', unames[i], 'display_name', names[i], 'demo', true)
    );

    UPDATE profiles SET
      display_name = names[i],
      bio = bios_arr[bio_idx],
      avatar_url = 'https://i.pravatar.cc/300?img=' || ((i % 70) + 1),
      cover_url = covers[cover_idx],
      is_verified = (i <= 30),
      subscription_price_cents = (CASE i % 5 WHEN 0 THEN 1990 WHEN 1 THEN 2990 WHEN 2 THEN 3990 WHEN 3 THEN 4990 ELSE 990 END),
      location = (CASE i % 6 WHEN 0 THEN 'São Paulo, SP' WHEN 1 THEN 'Rio de Janeiro, RJ' WHEN 2 THEN 'Belo Horizonte, MG'
                              WHEN 3 THEN 'Curitiba, PR' WHEN 4 THEN 'Porto Alegre, RS' ELSE 'Florianópolis, SC' END)
    WHERE user_id = creator_uid;

    INSERT INTO user_roles (user_id, role) VALUES (creator_uid, 'creator')
    ON CONFLICT DO NOTHING;

    IF i % 10 < 7 THEN
      INSERT INTO follows (follower_id, followee_id) VALUES (viewer, creator_uid);
    END IF;

    has_sub := (i % 4 = 0);
    IF has_sub THEN
      INSERT INTO subscriptions (subscriber_id, creator_id, price_cents, status, current_period_end)
      VALUES (viewer, creator_uid, 1990, 'active', now() + interval '30 days');
      INSERT INTO transactions (payer_id, payee_id, type, status, amount_cents, gateway)
      VALUES (viewer, creator_uid, 'subscription', 'paid', 1990, 'mock');
    END IF;

    total_per_post := 3 + (i % 3);
    FOR pic_idx IN 1..total_per_post LOOP
      body_idx := ((i + pic_idx) % array_length(bodies, 1)) + 1;
      visib := CASE
        WHEN pic_idx % 10 < 5 THEN 'public'
        WHEN pic_idx % 10 < 8 THEN 'subscribers'
        WHEN pic_idx % 10 = 8 THEN 'ppv'
        ELSE 'goal'
      END;
      has_goal := (visib = 'goal');

      post_id := gen_random_uuid();
      INSERT INTO posts (id, creator_id, body, visibility, price_cents, likes_count, comments_count, unlocks_count, created_at)
      VALUES (
        post_id, creator_uid, bodies[body_idx], visib::post_visibility,
        CASE WHEN visib = 'ppv' THEN (CASE pic_idx % 4 WHEN 0 THEN 990 WHEN 1 THEN 1490 WHEN 2 THEN 1990 ELSE 2990 END) ELSE 0 END,
        50 + ((i * 7 + pic_idx * 13) % 850),
        2 + ((i + pic_idx) % 40),
        ((i + pic_idx) % 30),
        now() - ((i * 3 + pic_idx * 7) || ' hours')::interval
      );

      INSERT INTO post_media (post_id, storage_path, mime_type, position)
      VALUES (post_id, post_imgs[((i * 3 + pic_idx) % array_length(post_imgs, 1)) + 1], 'image/jpeg', 0);

      IF has_goal THEN
        goal_target := 5000 + ((i % 5) * 2000);
        goal_raised := (goal_target * ((i * 13) % 90)) / 100;
        INSERT INTO post_goals (post_id, target_cents, raised_cents, unlock_price_cents, is_unlocked)
        VALUES (post_id, goal_target, goal_raised, 990, goal_raised >= goal_target);
      END IF;
    END LOOP;

    IF i % 5 < 3 THEN
      INSERT INTO stories (creator_id, media_path, mime_type, visibility, expires_at, views_count)
      VALUES (
        creator_uid, post_imgs[((i + 1) % array_length(post_imgs, 1)) + 1],
        'image/jpeg', 'public', now() + interval '20 hours', 50 + (i * 11) % 500
      );
    END IF;

    has_thread := has_sub OR (i % 5 = 0);
    IF has_thread THEN
      thread_id := gen_random_uuid();
      -- Ordena IDs (constraint do chat_threads exige user_a < user_b)
      IF creator_uid < viewer THEN ua := creator_uid; ub := viewer;
      ELSE ua := viewer; ub := creator_uid;
      END IF;

      INSERT INTO chat_threads (id, user_a, user_b, last_message_at)
      VALUES (thread_id, ua, ub, now() - ((i * 2) || ' minutes')::interval);

      INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
      VALUES (thread_id, creator_uid, 'Oi amor 😘 que bom te ver por aqui! Sou a ' || split_part(names[i], ' ', 1) || ', vou te tratar muito bem 💋',
              now() - interval '3 days');

      INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
      VALUES (thread_id, viewer, 'Oi linda! Adorei seu perfil, tem mais conteúdo?', now() - interval '3 days' + interval '2 minutes');

      INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
      VALUES (thread_id, creator_uid, 'Tenho sim 😈 acabei de gravar um vídeo bem safado, quer ver? Tô mandando aqui pra você.',
              now() - interval '2 days');

      msg_id := gen_random_uuid();
      INSERT INTO chat_messages (id, thread_id, sender_id, body, media_path, mime_type, ppv_price_cents, created_at)
      VALUES (msg_id, thread_id, creator_uid, NULL, post_imgs[((i + 5) % array_length(post_imgs, 1)) + 1], 'image/jpeg',
              CASE i % 4 WHEN 0 THEN 1990 WHEN 1 THEN 990 WHEN 2 THEN 2990 ELSE 1490 END,
              now() - interval '2 days' + interval '30 seconds');

      IF i % 6 = 0 THEN
        INSERT INTO chat_ppv_unlocks (message_id, user_id, amount_cents) VALUES (msg_id, viewer, 1490);
        INSERT INTO transactions (payer_id, payee_id, type, status, amount_cents, reference_id, gateway)
        VALUES (viewer, creator_uid, 'chat_ppv', 'paid', 1490, msg_id, 'mock');
      END IF;

      IF i % 7 = 0 THEN
        INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
        VALUES (thread_id, viewer, 'Te mandei um mimo 💖', now() - interval '1 day');
        INSERT INTO transactions (payer_id, payee_id, type, status, amount_cents, gateway, metadata)
        VALUES (viewer, creator_uid, 'tip', 'paid', 2000, 'mock', jsonb_build_object('source', 'chat'));
        INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
        VALUES (thread_id, creator_uid, 'AMORRR obrigada pelo mimo!! 🥰💋 te mando algo especial agora', now() - interval '1 day' + interval '1 minute');
      END IF;

      INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
      VALUES (thread_id, creator_uid,
              CASE i % 5
                WHEN 0 THEN 'Oi gato, tô online agora 🔥 vem trocar uma ideia comigo'
                WHEN 1 THEN 'Saudades de você... tô preparando algo especial só pra você 😘'
                WHEN 2 THEN 'Promo: assina hoje e ganha 1 vídeo exclusivo grátis! 💕'
                WHEN 3 THEN 'Aí amor, vc viu meu novo PPV? Tá MUITO bom 😈'
                ELSE 'Bom dia 💖 que tal começar o dia com algo gostoso?'
              END,
              now() - ((i * 2) || ' minutes')::interval);
    END IF;
  END LOOP;
END $$;
