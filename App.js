import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

const STORAGE_KEY = 'VOLLEYVISION_V1_STATE';

const TABS = ['Home', 'Roster', 'Games', 'Breakdown', 'Reports'];

const STAT_BUTTONS = [
  { key: 'ACE', label: 'Ace', group: 'Serve' },
  { key: 'SERVE_ATTEMPT', label: 'Serve', group: 'Serve' },
  { key: 'SERVE_ERROR', label: 'Serve Error', group: 'Serve' },
  { key: 'RECEPTION', label: 'Pass', group: 'Receive' },
  { key: 'RECEPTION_ERROR', label: 'Pass Error', group: 'Receive' },
  { key: 'SET', label: 'Set', group: 'Set' },
  { key: 'ASSIST', label: 'Assist', group: 'Set' },
  { key: 'BALL_HANDLING_ERROR', label: 'Ball Error', group: 'Set' },
  { key: 'ATTACK', label: 'Attack', group: 'Attack' },
  { key: 'KILL', label: 'Kill', group: 'Attack' },
  { key: 'ATTACK_ERROR', label: 'Attack Error', group: 'Attack' },
  { key: 'DIG', label: 'Dig', group: 'Defense' },
  { key: 'DEFENSIVE_ERROR', label: 'Def Error', group: 'Defense' },
  { key: 'SOLO_BLOCK', label: 'Solo Block', group: 'Block' },
  { key: 'BLOCK_ASSIST', label: 'Block Assist', group: 'Block' },
  { key: 'BLOCK_TOUCH', label: 'Block Touch', group: 'Block' },
  { key: 'BLOCK_ERROR', label: 'Block Error', group: 'Block' },
];

const REPORT_COLUMNS = [
  'ACE',
  'SERVE_ERROR',
  'RECEPTION',
  'RECEPTION_ERROR',
  'ASSIST',
  'KILL',
  'ATTACK_ERROR',
  'DIG',
  'SOLO_BLOCK',
  'BLOCK_ASSIST',
  'BLOCK_TOUCH',
  'BALL_HANDLING_ERROR',
];

const SHORT_LABELS = {
  ACE: 'Aces',
  SERVE_ATTEMPT: 'Srv',
  SERVE_ERROR: 'SE',
  RECEPTION: 'Pass',
  RECEPTION_ERROR: 'PE',
  SET: 'Set',
  ASSIST: 'Ast',
  BALL_HANDLING_ERROR: 'BHE',
  ATTACK: 'Att',
  KILL: 'Kills',
  ATTACK_ERROR: 'AE',
  DIG: 'Digs',
  DEFENSIVE_ERROR: 'DE',
  SOLO_BLOCK: 'SB',
  BLOCK_ASSIST: 'BA',
  BLOCK_TOUCH: 'BT',
  BLOCK_ERROR: 'BE',
};

const initialState = {
  teamName: 'VolleyVision Demo Team',
  players: [
    { id: 'p_12', name: 'Ava', number: '12', position: 'OH', active: true },
    { id: 'p_7', name: 'Mia', number: '7', position: 'S', active: true },
    { id: 'p_4', name: 'Emma', number: '4', position: 'L', active: true },
  ],
  games: [],
  statEvents: [],
  selectedGameId: null,
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function formatTime(seconds = 0) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const min = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const sec = (safeSeconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function getStatLabel(statType) {
  return STAT_BUTTONS.find((stat) => stat.key === statType)?.label || statType;
}

function buildPlayerTotals(players, events) {
  return players.map((player) => {
    const playerEvents = events.filter((event) => event.playerId === player.id);
    const totals = {};
    for (const col of REPORT_COLUMNS) totals[col] = 0;
    for (const event of playerEvents) {
      totals[event.statType] = (totals[event.statType] || 0) + 1;
    }
    return { player, totals, totalEvents: playerEvents.length };
  });
}

function calcHittingPct(totals) {
  const kills = totals.KILL || 0;
  const errors = totals.ATTACK_ERROR || 0;
  const attempts = totals.ATTACK || 0;
  if (!attempts) return '.000';
  const pct = (kills - errors) / attempts;
  return pct.toFixed(3).replace(/^0/, '');
}

function VideoBreakdownPlayer({ videoUri, onTimeChange }) {
  const player = useVideoPlayer(videoUri, (playerInstance) => {
    playerInstance.timeUpdateEventInterval = 0.25;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime || 0,
  });

  useEffect(() => {
    onTimeChange(currentTime || 0, player);
  }, [currentTime, onTimeChange, player]);

  return (
    <View style={styles.videoCard}>
      <VideoView
        style={styles.video}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
      />

      <View style={styles.videoControls}>
        <SmallButton label="-10" onPress={() => player.seekBy(-10)} />
        <SmallButton label="-5" onPress={() => player.seekBy(-5)} />
        <SmallButton
          label={isPlaying ? 'Pause' : 'Play'}
          onPress={() => (isPlaying ? player.pause() : player.play())}
        />
        <SmallButton label="+5" onPress={() => player.seekBy(5)} />
        <SmallButton label="+10" onPress={() => player.seekBy(10)} />
      </View>
    </View>
  );
}

function SmallButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.smallButton}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.primaryButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.ghostButton}>
      <Text style={styles.ghostButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [currentTime, setCurrentTime] = useState(0);
  const [activePlayer, setActivePlayer] = useState(null);
  const [playerRef, setPlayerRef] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setState(JSON.parse(raw));
      } catch (error) {
        Alert.alert('Storage error', 'Could not load saved VolleyVision data.');
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const selectedGame = useMemo(
    () => state.games.find((game) => game.id === state.selectedGameId) || state.games[0] || null,
    [state.games, state.selectedGameId]
  );

  useEffect(() => {
    if (!state.selectedGameId && state.games.length > 0) {
      setState((prev) => ({ ...prev, selectedGameId: prev.games[0].id }));
    }
  }, [state.games.length, state.selectedGameId]);

  const selectedGameEvents = useMemo(() => {
    if (!selectedGame) return [];
    return state.statEvents
      .filter((event) => event.gameId === selectedGame.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [selectedGame, state.statEvents]);

  const seasonTotals = useMemo(
    () => buildPlayerTotals(state.players, state.statEvents),
    [state.players, state.statEvents]
  );

  const gameTotals = useMemo(
    () => buildPlayerTotals(state.players, selectedGameEvents),
    [state.players, selectedGameEvents]
  );

  function addPlayer(player) {
    setState((prev) => ({ ...prev, players: [...prev.players, player] }));
  }

  function deletePlayer(playerId) {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((player) => player.id !== playerId),
      statEvents: prev.statEvents.filter((event) => event.playerId !== playerId),
    }));
  }

  async function addGame(opponent) {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('No video selected', 'Try picking the video again.');
      return;
    }

    const newGame = {
      id: makeId('game'),
      opponent: opponent?.trim() || 'Opponent',
      date: new Date().toISOString(),
      videoUri: asset.uri,
      videoName: asset.name || 'Game video',
      finalScore: '',
      notes: '',
      createdAt: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      games: [newGame, ...prev.games],
      selectedGameId: newGame.id,
    }));
    setActiveTab('Breakdown');
  }

  function deleteGame(gameId) {
    setState((prev) => {
      const remainingGames = prev.games.filter((game) => game.id !== gameId);
      return {
        ...prev,
        games: remainingGames,
        selectedGameId: remainingGames[0]?.id || null,
        statEvents: prev.statEvents.filter((event) => event.gameId !== gameId),
      };
    });
  }

  function addStat(statType, playerId) {
    if (!selectedGame) return;
    const newEvent = {
      id: makeId('stat'),
      gameId: selectedGame.id,
      playerId,
      statType,
      timestamp: currentTime,
      setNumber: 1,
      note: '',
      createdAt: Date.now(),
    };

    setState((prev) => ({ ...prev, statEvents: [newEvent, ...prev.statEvents] }));
  }

  function undoLastStat() {
    if (!selectedGameEvents.length) return;
    const lastId = selectedGameEvents[0].id;
    setState((prev) => ({
      ...prev,
      statEvents: prev.statEvents.filter((event) => event.id !== lastId),
    }));
  }

  function jumpToStat(event) {
    if (!playerRef) return;
    playerRef.currentTime = Math.max(0, event.timestamp - 4);
    playerRef.play();
  }

  function resetDemo() {
    Alert.alert('Reset VolleyVision?', 'This clears all players, games, and stats on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setState(initialState);
          setActiveTab('Home');
        },
      },
    ]);
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.logo}>VolleyVision</Text>
        <Text style={styles.muted}>Loading saved team data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>VolleyVision</Text>
          <Text style={styles.tagline}>Film in. Stats out.</Text>
        </View>
        <Text style={styles.clock}>{formatTime(currentTime)}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'Home' && (
        <HomeScreen
          state={state}
          selectedGame={selectedGame}
          selectedGameEvents={selectedGameEvents}
          seasonTotals={seasonTotals}
          setActiveTab={setActiveTab}
          resetDemo={resetDemo}
        />
      )}

      {activeTab === 'Roster' && (
        <RosterScreen players={state.players} addPlayer={addPlayer} deletePlayer={deletePlayer} />
      )}

      {activeTab === 'Games' && (
        <GamesScreen
          games={state.games}
          selectedGameId={state.selectedGameId}
          addGame={addGame}
          deleteGame={deleteGame}
          selectGame={(gameId) => setState((prev) => ({ ...prev, selectedGameId: gameId }))}
          openBreakdown={() => setActiveTab('Breakdown')}
        />
      )}

      {activeTab === 'Breakdown' && (
        <BreakdownScreen
          selectedGame={selectedGame}
          players={state.players}
          events={selectedGameEvents}
          addStat={addStat}
          undoLastStat={undoLastStat}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          activePlayer={activePlayer}
          setActivePlayer={setActivePlayer}
          jumpToStat={jumpToStat}
          setPlayerRef={setPlayerRef}
          openGames={() => setActiveTab('Games')}
        />
      )}

      {activeTab === 'Reports' && (
        <ReportsScreen
          selectedGame={selectedGame}
          gameTotals={gameTotals}
          seasonTotals={seasonTotals}
          events={selectedGameEvents}
          jumpToStat={jumpToStat}
        />
      )}
    </SafeAreaView>
  );
}

function HomeScreen({ state, selectedGame, selectedGameEvents, seasonTotals, setActiveTab, resetDemo }) {
  const teamKills = seasonTotals.reduce((sum, row) => sum + (row.totals.KILL || 0), 0);
  const teamDigs = seasonTotals.reduce((sum, row) => sum + (row.totals.DIG || 0), 0);
  const teamAces = seasonTotals.reduce((sum, row) => sum + (row.totals.ACE || 0), 0);
  const teamBlocks = seasonTotals.reduce(
    (sum, row) => sum + (row.totals.SOLO_BLOCK || 0) + (row.totals.BLOCK_ASSIST || 0),
    0
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{state.teamName}</Text>
        <Text style={styles.heroText}>Break down game film into timestamped volleyball stats.</Text>
        <View style={styles.rowGap}>
          <PrimaryButton label="Add Game Video" onPress={() => setActiveTab('Games')} />
          <GhostButton label="Break Down Film" onPress={() => setActiveTab('Breakdown')} />
        </View>
      </View>

      <View style={styles.statGrid}>
        <Metric label="Players" value={state.players.length} />
        <Metric label="Games" value={state.games.length} />
        <Metric label="Stats Tagged" value={state.statEvents.length} />
        <Metric label="Current Game" value={selectedGameEvents.length} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Season Snapshot</Text>
        <View style={styles.statGrid}>
          <Metric label="Kills" value={teamKills} />
          <Metric label="Digs" value={teamDigs} />
          <Metric label="Aces" value={teamAces} />
          <Metric label="Blocks" value={teamBlocks} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Selected Game</Text>
        {selectedGame ? (
          <>
            <Text style={styles.listTitle}>{selectedGame.opponent}</Text>
            <Text style={styles.muted}>{new Date(selectedGame.date).toLocaleDateString()}</Text>
            <Text style={styles.muted}>{selectedGame.videoName}</Text>
          </>
        ) : (
          <Text style={styles.muted}>No game loaded yet. Add a video in the Games tab.</Text>
        )}
      </View>

      <GhostButton label="Reset local demo data" onPress={resetDemo} />
    </ScrollView>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RosterScreen({ players, addPlayer, deletePlayer }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');

  function submit() {
    if (!name.trim() || !number.trim()) {
      Alert.alert('Missing info', 'Add at least a player name and jersey number.');
      return;
    }

    addPlayer({
      id: makeId('player'),
      name: name.trim(),
      number: number.trim(),
      position: position.trim() || 'Player',
      active: true,
    });

    setName('');
    setNumber('');
    setPosition('');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Player</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Player name" style={styles.input} />
        <TextInput
          value={number}
          onChangeText={setNumber}
          placeholder="Jersey number"
          keyboardType="number-pad"
          style={styles.input}
        />
        <TextInput value={position} onChangeText={setPosition} placeholder="Position, ex: OH, S, L" style={styles.input} />
        <PrimaryButton label="Add Player" onPress={submit} />
      </View>

      <Text style={styles.sectionTitle}>Roster</Text>
      {players.map((player) => (
        <View key={player.id} style={styles.listCard}>
          <View>
            <Text style={styles.listTitle}>#{player.number} {player.name}</Text>
            <Text style={styles.muted}>{player.position}</Text>
          </View>
          <GhostButton label="Delete" onPress={() => deletePlayer(player.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

function GamesScreen({ games, selectedGameId, addGame, deleteGame, selectGame, openBreakdown }) {
  const [opponent, setOpponent] = useState('');

  async function submit() {
    await addGame(opponent);
    setOpponent('');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Game Film</Text>
        <TextInput value={opponent} onChangeText={setOpponent} placeholder="Opponent / tournament name" style={styles.input} />
        <PrimaryButton label="Pick Video From Phone" onPress={submit} />
        <Text style={styles.helperText}>Best setup: tripod, high angle, full court visible, clear jersey numbers.</Text>
      </View>

      <Text style={styles.sectionTitle}>Games</Text>
      {games.length === 0 && <Text style={styles.muted}>No videos yet.</Text>}
      {games.map((game) => (
        <View key={game.id} style={[styles.listCard, game.id === selectedGameId && styles.selectedCard]}>
          <Pressable
            onPress={() => {
              selectGame(game.id);
              openBreakdown();
            }}
            style={{ flex: 1 }}
          >
            <Text style={styles.listTitle}>{game.opponent}</Text>
            <Text style={styles.muted}>{new Date(game.date).toLocaleDateString()}</Text>
            <Text style={styles.muted} numberOfLines={1}>{game.videoName}</Text>
          </Pressable>
          <GhostButton label="Delete" onPress={() => deleteGame(game.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

function BreakdownScreen({
  selectedGame,
  players,
  events,
  addStat,
  undoLastStat,
  currentTime,
  setCurrentTime,
  activePlayer,
  setActivePlayer,
  jumpToStat,
  setPlayerRef,
  openGames,
}) {
  const groupedStats = useMemo(() => {
    return STAT_BUTTONS.reduce((groups, stat) => {
      groups[stat.group] = groups[stat.group] || [];
      groups[stat.group].push(stat);
      return groups;
    }, {});
  }, []);

  if (!selectedGame) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>No Game Selected</Text>
          <Text style={styles.muted}>Add a video first, then come back here to tag stats.</Text>
          <PrimaryButton label="Add Game Video" onPress={openGames} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{selectedGame.opponent}</Text>
        <Text style={styles.muted}>{selectedGame.videoName}</Text>
      </View>

      <VideoBreakdownPlayer
        key={selectedGame.videoUri}
        videoUri={selectedGame.videoUri}
        onTimeChange={(time, player) => {
          setCurrentTime(time);
          setPlayerRef(player);
        }}
      />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Pick Player</Text>
        <View style={styles.playerChips}>
          {players.map((player) => (
            <Pressable
              key={player.id}
              style={[styles.playerChip, activePlayer === player.id && styles.activePlayerChip]}
              onPress={() => setActivePlayer(player.id)}
            >
              <Text style={[styles.playerChipText, activePlayer === player.id && styles.activePlayerChipText]}>
                #{player.number} {player.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {!activePlayer && <Text style={styles.helperText}>Pick a player first, then tap the stat button.</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.spaceBetween}>
          <Text style={styles.sectionTitle}>2. Tap Stat</Text>
          <Text style={styles.timestampPill}>{formatTime(currentTime)}</Text>
        </View>

        {Object.keys(groupedStats).map((group) => (
          <View key={group} style={styles.statGroup}>
            <Text style={styles.groupTitle}>{group}</Text>
            <View style={styles.statButtons}>
              {groupedStats[group].map((stat) => (
                <Pressable
                  key={stat.key}
                  style={[styles.statButton, !activePlayer && styles.disabledButton]}
                  onPress={() => activePlayer && addStat(stat.key, activePlayer)}
                >
                  <Text style={styles.statButtonText}>{stat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.spaceBetween}>
          <Text style={styles.sectionTitle}>Tag Log</Text>
          <GhostButton label="Undo Last" onPress={undoLastStat} />
        </View>
        {events.length === 0 && <Text style={styles.muted}>No stats tagged yet.</Text>}
        {events.slice(0, 30).map((event) => {
          const player = players.find((p) => p.id === event.playerId);
          return (
            <Pressable key={event.id} style={styles.eventRow} onPress={() => jumpToStat(event)}>
              <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
              <Text style={styles.eventText}>#{player?.number || '?'} {player?.name || 'Unknown'}</Text>
              <Text style={styles.eventStat}>{getStatLabel(event.statType)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ReportsScreen({ selectedGame, gameTotals, seasonTotals, events, jumpToStat }) {
  const [scope, setScope] = useState('Game');
  const rows = scope === 'Game' ? gameTotals : seasonTotals;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reports</Text>
        <Text style={styles.muted}>{scope === 'Game' && selectedGame ? selectedGame.opponent : 'Season totals'}</Text>
        <View style={styles.rowGap}>
          <PrimaryButton label="Game" onPress={() => setScope('Game')} />
          <GhostButton label="Season" onPress={() => setScope('Season')} />
        </View>
      </View>

      <ScrollView horizontal style={styles.reportScroller}>
        <View>
          <View style={styles.reportRowHeader}>
            <Text style={[styles.reportCell, styles.playerReportCell]}>Player</Text>
            {REPORT_COLUMNS.map((col) => (
              <Text key={col} style={styles.reportCell}>{SHORT_LABELS[col]}</Text>
            ))}
            <Text style={styles.reportCell}>Hit%</Text>
          </View>

          {rows.map(({ player, totals }) => (
            <View key={player.id} style={styles.reportRow}>
              <Text style={[styles.reportCell, styles.playerReportCell]}>#{player.number} {player.name}</Text>
              {REPORT_COLUMNS.map((col) => (
                <Text key={col} style={styles.reportCell}>{totals[col] || 0}</Text>
              ))}
              <Text style={styles.reportCell}>{calcHittingPct(totals)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Clip Finder</Text>
        <Text style={styles.helperText}>Tap any tag to jump to four seconds before the play.</Text>
        {events.slice(0, 50).map((event) => (
          <Pressable key={event.id} style={styles.eventRow} onPress={() => jumpToStat(event)}>
            <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
            <Text style={styles.eventText}>{getStatLabel(event.statType)}</Text>
            <Text style={styles.eventStat}>Watch</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#93c5fd',
    marginTop: 2,
    fontWeight: '700',
  },
  clock: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 999,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#38bdf8',
  },
  tabText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
  },
  activeTabText: {
    color: '#082f49',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  screenContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: '#cbd5e1',
    marginTop: 8,
    marginBottom: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  videoCard: {
    backgroundColor: '#020617',
    borderRadius: 18,
    padding: 10,
    marginBottom: 14,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  videoControls: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
  },
  muted: {
    color: '#64748b',
    fontWeight: '600',
  },
  helperText: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  ghostButton: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: '#075985',
    fontWeight: '900',
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metric: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  metricLabel: {
    color: '#64748b',
    fontWeight: '800',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
    fontWeight: '700',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedCard: {
    borderColor: '#0284c7',
    borderWidth: 2,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  playerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activePlayerChip: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  playerChipText: {
    color: '#334155',
    fontWeight: '900',
  },
  activePlayerChipText: {
    color: '#ffffff',
  },
  timestampPill: {
    color: '#075985',
    backgroundColor: '#e0f2fe',
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontWeight: '900',
  },
  statGroup: {
    marginTop: 8,
  },
  groupTitle: {
    color: '#475569',
    fontWeight: '900',
    marginBottom: 8,
  },
  statButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statButton: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: '30%',
    alignItems: 'center',
  },
  statButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  eventTime: {
    fontWeight: '900',
    color: '#075985',
    width: 54,
  },
  eventText: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '800',
  },
  eventStat: {
    color: '#334155',
    fontWeight: '900',
  },
  reportScroller: {
    marginBottom: 14,
  },
  reportRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  reportRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  reportCell: {
    width: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontWeight: '900',
    color: '#0f172a',
  },
  playerReportCell: {
    width: 130,
  },
});
