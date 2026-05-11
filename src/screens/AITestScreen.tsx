import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SettingsService from '../services/SettingsService';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

type ProviderStatus = 'loading' | 'ready' | 'no-key';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function AITestScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [provider, setProvider] = useState<'claude' | 'openai'>('claude');
  const [status, setStatus] = useState<ProviderStatus>('loading');
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadProvider();
  }, []);

  async function loadProvider() {
    setStatus('loading');
    const settings = await SettingsService.load();
    const prov = settings.analysisProvider;
    setProvider(prov);

    const key = prov === 'claude'
      ? await SettingsService.getClaudeApiKey()
      : await SettingsService.getOpenAIApiKey();

    setApiKey(key);
    setStatus(key ? 'ready' : 'no-key');
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      let responseText: string;

      if (provider === 'claude') {
        // Direct call to Anthropic Messages API
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: text }],
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        }
        responseText = json.content?.[0]?.text ?? '(empty response)';
      } else {
        // Direct call to OpenAI Chat Completions API
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: text }],
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        }
        responseText = json.choices?.[0]?.message?.content ?? '(empty response)';
      }

      setMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const providerLabel = provider === 'claude' ? 'Claude (Anthropic)' : 'GPT-4o-mini (OpenAI)';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Test</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Provider badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, status === 'no-key' && styles.badgeError]}>
          <Text style={styles.badgeText}>
            {status === 'loading' ? 'Loading…'
              : status === 'no-key' ? `⚠ No API key — ${providerLabel}`
              : `✓ ${providerLabel}`}
          </Text>
        </View>
        {status === 'no-key' && (
          <Text style={styles.keyHint}>Set your key in Settings → Analysis Provider</Text>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled">

        {messages.length === 0 && (
          <Text style={styles.emptyHint}>
            Type a message and tap Send to test the AI connection.
          </Text>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}>
            <Text style={[styles.bubbleLabel, msg.role === 'user' && styles.bubbleLabelUser]}>
              {msg.role === 'user' ? 'You' : providerLabel}
            </Text>
            <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
              {msg.text}
            </Text>
          </View>
        ))}

        {sending && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <Text style={styles.bubbleLabel}>{providerLabel}</Text>
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 4 }} />
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything…"
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          editable={status === 'ready' && !sending}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || sending || status !== 'ready') && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || sending || status !== 'ready'}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorPalette) {
  const ACCENT = '#8B5CF6'; // purple — distinct from other screens
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: ACCENT + '18',
      borderBottomWidth: 2,
      borderBottomColor: ACCENT,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    headerBtn: { fontSize: 17, color: ACCENT, minWidth: 48 },

    badgeRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 4 },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: ACCENT + '20',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: ACCENT + '60',
    },
    badgeError: { backgroundColor: '#EF444420', borderColor: '#EF4444' },
    badgeText: { fontSize: 13, fontWeight: '600', color: colors.text },
    keyHint: { fontSize: 12, color: colors.placeholder, marginLeft: 4 },

    messages: { flex: 1 },
    messagesContent: { padding: 16, gap: 12 },
    emptyHint: { fontSize: 15, color: colors.placeholder, textAlign: 'center', marginTop: 40 },

    bubble: {
      borderRadius: 14,
      padding: 12,
      maxWidth: '88%',
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: ACCENT,
    },
    bubbleAssistant: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bubbleLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.placeholder,
      marginBottom: 4,
    },
    bubbleLabelUser: { color: '#ffffff99' },
    bubbleText: { fontSize: 15, color: colors.text, lineHeight: 22 },
    bubbleTextUser: { color: '#fff' },

    errorBox: {
      backgroundColor: '#EF444415',
      borderRadius: 10,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: '#EF4444',
    },
    errorText: { fontSize: 14, color: '#EF4444' },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 44,
      maxHeight: 120,
      textAlignVertical: 'top',
    },
    sendBtn: {
      backgroundColor: ACCENT,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: colors.placeholder },
    sendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
