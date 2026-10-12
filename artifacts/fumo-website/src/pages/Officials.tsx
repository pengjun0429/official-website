import { toChineseError } from "@/lib/errorMessage";
import { apiUrl } from "@/lib/api";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, RefreshCw, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface Official {
  nickname: string;
  position: string;
  responsibilities: string;
}

interface OfficialsResponse {
  people: Official[];
  lastUpdated: string;
  isStale: boolean;
  source: string;
}

async function fetchOfficials(forceRefresh = false): Promise<OfficialsResponse> {
  const url = apiUrl(`/api/officials${forceRefresh ? "?refresh=1" : ""}`);
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || "載入公職與秘書處人員失敗。");
  }
  return response.json();
}

const positionLabels: Record<string, string> = {
  "秘書長": "Secretary-General",
  "祕書長": "Secretary-General",
  "秘書處人員": "Secretariat Staff",
  "祕書處人員": "Secretariat Staff",
  "約聘人士": "Contract Staff",
  "約聘顧問": "Contract Advisor",
};

const responsibilityLabels: Record<string, string> = {
  "技術部": "Technology Department",
  "總務部執行署": "General Affairs Executive Office",
  "安全部": "Security Department",
  "文書部": "Records Department",
  "文書部百科署": "Records & Encyclopaedia Office",
  "百科署": "Encyclopaedia Office",
  "登記署": "Registration Office",
  "執行署": "Executive Office",
  "會務署": "Conference Affairs Office",
  "Tiktok區管理員": "TikTok Community Moderator",
  "微信區管理員": "WeChat Community Moderator",
  "Line區管理員": "LINE Community Moderator",
};

function positionLabel(position: string, isEnglish: boolean) {
  return isEnglish ? positionLabels[position] ?? position : position;
}

function responsibilityLabelsFor(value: string, isEnglish: boolean) {
  if (!value) return [];
  return value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean).map((item) => (
    isEnglish ? responsibilityLabels[item] ?? item : item
  ));
}

export default function Officials() {
  const { isEnglish } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery<OfficialsResponse>({
    queryKey: ["officials"],
    queryFn: () => fetchOfficials(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const groups = useMemo(() => {
    const grouped = new Map<string, Official[]>();
    for (const person of data?.people ?? []) {
      const people = grouped.get(person.position) ?? [];
      people.push(person);
      grouped.set(person.position, people);
    }
    return [...grouped.entries()];
  }, [data?.people]);

  const formattedUpdatedAt = data?.lastUpdated
    ? new Intl.DateTimeFormat(isEnglish ? "en" : "zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.lastUpdated))
    : null;

  return (
    <div className="min-h-screen bg-muted/10 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/15 text-secondary mb-5">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-4">
            {isEnglish ? "Public Offices & Secretariat" : "公職與秘書處"}
          </h1>
          <p className="text-foreground/70 mb-6">
            {isEnglish
              ? "Meet the officials and Secretariat personnel serving the organisation. This directory is synchronised from FUMO’s public spreadsheet."
              : "認識聯合微國家組織現任公職與秘書處人員。本名錄同步自組織公開資料表，表格更新後網站會自動更新。"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => { void queryClient.fetchQuery({ queryKey: ["officials"], queryFn: () => fetchOfficials(true), staleTime: 0 }).catch(() => undefined); }}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? (isEnglish ? "Syncing..." : "同步中...") : (isEnglish ? "Sync now" : "立即同步")}
            </Button>
            {data?.source && (
              <Button asChild variant="ghost" className="text-secondary">
                <a href={data.source} target="_blank" rel="noopener noreferrer">
                  {isEnglish ? "Open source spreadsheet" : "查看來源表格"}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
          {formattedUpdatedAt && (
            <p className="text-xs text-muted-foreground mt-3">
              {isEnglish ? "Last synced:" : "上次同步："} {formattedUpdatedAt}
            </p>
          )}
          {data?.isStale && (
            <p role="status" className="text-sm text-amber-700 mt-3">
              {isEnglish ? "The latest spreadsheet sync failed; showing the last successfully synced data." : "最新表格同步失敗，目前顯示上次成功同步的資料。"}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground" role="status">
            {isEnglish ? "Loading personnel..." : "正在載入人員名錄..."}
          </div>
        ) : error ? (
          <Card className="max-w-2xl mx-auto border-destructive/30">
            <CardContent className="py-10 text-center">
              <p className="text-lg font-medium text-destructive">
                {isEnglish ? "Unable to load the personnel list." : toChineseError(error)}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                {isEnglish ? "Try again" : "重新載入"}
              </Button>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {isEnglish ? "No personnel are currently listed." : "目前沒有可顯示的人員資料。"}
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map(([position, people], groupIndex) => (
              <motion.section
                key={position}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: groupIndex * 0.06 }}
                aria-labelledby={`officials-${groupIndex}`}
              >
                <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 mb-5">
                  <div>
                    <h2 id={`officials-${groupIndex}`} className="text-2xl font-bold text-primary">
                      {positionLabel(position, isEnglish)}
                    </h2>
                    {isEnglish && positionLabels[position] && <p className="text-sm text-muted-foreground mt-1">{position}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {people.length} {isEnglish ? (people.length === 1 ? "person" : "people") : "人"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {people.map((person, index) => {
                    const responsibilities = person.responsibilities === person.position ? [] : responsibilityLabelsFor(person.responsibilities, isEnglish);
                    return (
                      <Card key={`${person.nickname}-${index}`} className="h-full bg-white border-border/60 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-xl text-primary">{person.nickname}</CardTitle>
                          <p className="text-sm font-medium text-foreground/65">{positionLabel(person.position, isEnglish)}</p>
                        </CardHeader>
                        {responsibilities.length > 0 && (
                          <CardContent className="pt-0">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                              {isEnglish ? "Areas of responsibility" : "負責區域"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {responsibilities.map((responsibility) => (
                                <Badge key={responsibility} variant="outline" className="font-normal">{responsibility}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
