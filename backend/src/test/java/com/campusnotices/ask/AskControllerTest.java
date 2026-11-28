package com.campusnotices.ask;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campusnotices.account.SessionUser;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** AI mode over HTTP: off without a key, per-user hourly limit, and how much history reaches the model. */
class AskControllerTest {

	private static final AssistantProperties PROPS = new AssistantProperties("claude-test", 2, 6);

	/** Records what the controller hands the assistant instead of calling Claude. */
	private static final class FakeAssistant extends NoticeAssistant {
		final BlockingQueue<List<Turn>> histories = new ArrayBlockingQueue<>(10);
		final BlockingQueue<String> questions = new ArrayBlockingQueue<>(10);

		FakeAssistant() {
			super(null, null, PROPS, false);
		}

		@Override
		public void ask(String question, List<Turn> history, Consumer<Event> events) {
			questions.add(question);
			histories.add(history);
			events.accept(new Event.Answer("ok", List.of(), "claude-test"));
		}
	}

	private static NoticeAssistant.Turn turn(int i) {
		return new NoticeAssistant.Turn("q" + i, "a" + i);
	}

	@Test
	void statusSaysOffWithoutAnAssistant() {
		AskController off = new AskController(null, PROPS);

		assertThat(off.status()).isEqualTo(new AskController.Status(false, null));
		assertThatThrownBy(() -> off.ask(null, new AskController.Question("hi", null)))
				.isInstanceOfSatisfying(ResponseStatusException.class,
						e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
	}

	@Test
	void statusNamesTheModelWhenOn() {
		assertThat(new AskController(new FakeAssistant(), PROPS).status())
				.isEqualTo(new AskController.Status(true, "claude-test"));
	}

	@Test
	void limitsEachUserSeparately() {
		AskController c = new AskController(new FakeAssistant(), PROPS);

		assertThat(c.allow("user-1")).isTrue();
		assertThat(c.allow("user-1")).isTrue();
		assertThat(c.allow("user-1")).isFalse();
		// someone else still has their own two questions
		assertThat(c.allow("user-2")).isTrue();
	}

	@Test
	void answersTooManyRequestsOnceTheHourIsUsedUp() {
		AskController c = new AskController(new FakeAssistant(), PROPS);
		SessionUser user = new SessionUser(7, "student@ajou.ac.kr");
		AskController.Question q = new AskController.Question("When is the dorm deadline?", null);

		c.ask(user, q);
		c.ask(user, q);

		assertThatThrownBy(() -> c.ask(user, q))
				.isInstanceOfSatisfying(ResponseStatusException.class, e -> {
					assertThat(e.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
					assertThat(e.getReason()).contains("2 questions");
				});
	}

	@Test
	void desktopUserWithoutSignInSharesOneLimit() {
		AskController c = new AskController(new FakeAssistant(), PROPS);
		AskController.Question q = new AskController.Question("hi", null);

		c.ask(null, q);
		c.ask(null, q);

		assertThat(c.allow("this-pc")).isFalse();
	}

	@Test
	void sendsOnlyTheLastFewCompleteTurnsAndAStrippedQuestion() throws InterruptedException {
		FakeAssistant fake = new FakeAssistant();
		AskController c = new AskController(fake, new AssistantProperties("claude-test", 30, 6));
		List<NoticeAssistant.Turn> history = new java.util.ArrayList<>(
				List.of(turn(1), turn(2), turn(3), turn(4), turn(5)));
		history.add(new NoticeAssistant.Turn("unanswered", null));

		c.ask(null, new AskController.Question("  and the deadline?  ", history));

		assertThat(fake.questions.poll(5, TimeUnit.SECONDS)).isEqualTo("and the deadline?");
		// the last MAX_HISTORY entries are kept, then the one with no answer is dropped
		assertThat(fake.histories.poll(5, TimeUnit.SECONDS)).containsExactly(turn(3), turn(4), turn(5));
	}

	@Test
	void noHistoryMeansAnEmptyList() throws InterruptedException {
		FakeAssistant fake = new FakeAssistant();
		AskController c = new AskController(fake, PROPS);

		c.ask(null, new AskController.Question("hi", null));

		assertThat(fake.histories.poll(5, TimeUnit.SECONDS)).isEmpty();
	}
}
